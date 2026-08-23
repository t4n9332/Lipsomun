/**
 * 토스쇼핑 가격비교 매칭 도구 (Playwright)
 * ================================================
 * 핵심: 사이트에 이미 등록된 쿠팡 상품과 "동일한 상품"을 토스쇼핑에서 찾아
 * 쉐어링크(수익 링크) + 토스 가격을 쿠팡 링크 바로 아래에 붙입니다.
 * → 상세 페이지에서 쿠팡/토스 가격비교 버튼이 나란히 표시됩니다.
 *
 * 준비:
 *   npm i -D playwright && npx playwright install chromium   (설치 완료됨)
 *   node scripts/toss-login.mjs   ← 최초 1회 로그인 (프로필에 저장)
 *
 * 실행:
 *   node scripts/toss-playwright.mjs
 *
 * 모드:
 *   1) 쿠팡 상품 매칭 (기본) — 사이트에서 '쿠팡 링크는 있고 토스 링크는 없는' 상품을
 *      가져와 토스쇼핑 검색 → 제목 유사도로 동일 상품 판별 → 쉐어링크·가격 수집 →
 *      사이트에 토스 링크 추가 (관리자 API POST /api/admin/links)
 *   2) 목록 수집 신규 등록 — 브라우저에 열린 토스 목록 페이지의 상품을 신규 등록
 *
 * ⚠️ 모드 1은 사이트에 GET /api/admin/products, POST /api/admin/links 엔드포인트가
 *    배포되어 있어야 합니다 (이번 업데이트에 포함 — 배포 후 사용).
 */

import { createInterface } from "node:readline/promises";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, ".toss-profile");
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const SHARELINK_RE = /https:\/\/toss\.im\/_m\/[A-Za-z0-9]+/;

const CATEGORIES = [
  "가전/디지털", "생활용품", "주방용품", "식품", "뷰티", "패션",
  "홈인테리어", "스포츠/레저", "육아", "반려동물", "기타",
];

const rl = createInterface({ input: process.stdin, output: process.stdout });

/* ---------- 설정 / 인증 ---------- */

async function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    } catch {}
  }
  console.log("\n=== 최초 설정 ===");
  let siteUrl = (await rl.question("사이트 주소 (기본: https://lipsomun.co.kr): ")).trim();
  if (!siteUrl) siteUrl = "https://lipsomun.co.kr";
  const adminPassword = (await rl.question("관리자 비밀번호 (Vercel의 ADMIN_PASSWORD): ")).trim();
  const config = { siteUrl: siteUrl.replace(/\/+$/, ""), adminPassword };
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log("설정 저장 완료 (.toss-config.json — 이 파일은 공유하지 마세요)");
  return config;
}

function adminCookie(config) {
  // 사이트와 동일한 방식: sha256("ipsomun:" + 비밀번호)
  const token = createHash("sha256").update("ipsomun:" + config.adminPassword).digest("hex");
  return `ipsomun_admin=${token}`;
}

async function siteApi(config, method, apiPath, body) {
  const res = await fetch(config.siteUrl + apiPath, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie(config),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`사이트 API ${apiPath} 오류(${res.status}): ${data.error || "?"}`);
  return data;
}

/* ---------- 제목 유사도 (동일 상품 판별) ---------- */

function tokenize(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^\w가-힣.]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** 자카드 유사도 + 숫자 토큰(용량·수량) 가중치 */
function similarity(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  let numInter = 0;
  let numTotal = 0;
  for (const t of ta) {
    if (/\d/.test(t)) numTotal++;
    if (tb.has(t)) {
      inter++;
      if (/\d/.test(t)) numInter++;
    }
  }
  const union = ta.size + tb.size - inter;
  const jaccard = inter / union;
  // 숫자 토큰(500ml, 60개 등)이 다르면 다른 옵션일 가능성 → 감점
  const numScore = numTotal === 0 ? 1 : numInter / numTotal;
  return jaccard * 0.7 + numScore * 0.3;
}

/* ---------- 토스쇼핑 페이지 조작 ---------- */

/** 상세 페이지에서 정보 추출 (제목/이미지: og, 평점·리뷰수: og:description, 가격: 본문) */
async function extractProduct(page) {
  return page.evaluate(() => {
    const meta = (name) =>
      document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content || "";
    const title = (meta("og:title") || document.title || "")
      .replace(/\s*\|\s*토스쇼핑\s*$/, "")
      .trim();
    const imageUrl = meta("og:image") || "";
    const desc = meta("og:description") || "";
    let rating = null;
    let ratingCount = null;
    const dm = desc.match(/리뷰\s*([0-9,]+)개\s*·?\s*평점\s*([0-5](?:\.[0-9])?)점/);
    if (dm) {
      ratingCount = Number(dm[1].replace(/,/g, "")) || null;
      rating = Number(dm[2]) || null;
    }
    let price = null;
    const pm = document.body.innerText.match(/([0-9][0-9,]{2,})원/);
    if (pm) price = Number(pm[1].replace(/,/g, "")) || null;
    return { title: title.slice(0, 200), imageUrl, price, rating, ratingCount };
  });
}

/** 검색 결과에서 상품 후보 수집: [{url, title}] */
async function searchToss(page, query) {
  const url = "https://toss.shopping/search?query=" + encodeURIComponent(query);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  return page.evaluate(() => {
    const seen = new Set();
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/t/"]')) {
      const m = (a.getAttribute("href") || "").match(/\/t\/(\d+)/);
      if (!m || seen.has(m[1])) continue;
      seen.add(m[1]);
      const title = (a.innerText || "").split("\n").filter(Boolean)[0] || "";
      out.push({ url: `https://toss.shopping/t/${m[1]}`, title: title.slice(0, 200) });
      if (out.length >= 8) break;
    }
    return out;
  });
}

/** 페이지/클립보드 어디서든 쉐어링크(toss.im/_m/...) 탐색 */
async function findSharelinkOnPage(page) {
  const clip = await page
    .evaluate(() => navigator.clipboard.readText().catch(() => ""))
    .catch(() => "");
  const m1 = (clip || "").match(SHARELINK_RE);
  if (m1) return m1[0];
  const html = await page.content();
  const m2 = html.match(SHARELINK_RE);
  return m2 ? m2[0] : null;
}

/** 공유 아이콘 → '쉐어링크 공유하기' → 링크 복사 자동 클릭 */
async function tryAutoSharelink(page, context) {
  await context
    .grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "https://toss.shopping",
    })
    .catch(() => {});

  const shareOpeners = [
    '[aria-label*="공유"]',
    'button:has-text("공유")',
    '[data-testid*="share"]',
  ];
  for (const sel of shareOpeners) {
    const btn = page.locator(sel).first();
    if (!(await btn.count())) continue;
    await btn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1200);
    break;
  }

  const sharelinkBtn = page
    .locator(
      'button:has-text("쉐어링크"), [role="button"]:has-text("쉐어링크"), a:has-text("쉐어링크")'
    )
    .first();
  if (await sharelinkBtn.count()) {
    await sharelinkBtn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const copyBtn = page
    .locator('button:has-text("링크 복사"), button:has-text("복사"), [aria-label*="복사"]')
    .first();
  if (await copyBtn.count()) {
    await copyBtn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  const link = await findSharelinkOnPage(page);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);
  return link;
}

/** 자동 발급 실패 시 수동 붙여넣기 */
async function getSharelink(page, context) {
  const auto = await tryAutoSharelink(page, context);
  if (auto) return { link: auto, auto: true };
  const manual = (
    await rl.question(
      "  자동 발급 실패 — 브라우저에서 공유 → '쉐어링크 공유하기'로 복사한 링크를 붙여넣으세요 (건너뛰려면 엔터): "
    )
  ).trim();
  const m = manual.match(SHARELINK_RE);
  return m ? { link: m[0], auto: false } : { link: null, auto: false };
}

/* ---------- 모드 1: 쿠팡 상품 매칭 (핵심) ---------- */

async function runMatch(config, page, context) {
  console.log("\n사이트에서 상품 목록을 가져오는 중...");
  const { products } = await siteApi(config, "GET", "/api/admin/products?limit=1000");

  const targets = products.filter(
    (p) =>
      p.isPublished &&
      p.links.some((l) => l.platform === "coupang") &&
      !p.links.some((l) => l.platform === "toss")
  );
  console.log(
    `전체 ${products.length}개 중 매칭 대상(쿠팡 O, 토스 X): ${targets.length}개`
  );
  if (targets.length === 0) {
    console.log("매칭할 상품이 없습니다.");
    return;
  }

  const maxStr = (await rl.question(`이번에 몇 개 처리할까요? (기본 ${Math.min(targets.length, 20)}): `)).trim();
  const max = Math.min(Number(maxStr) || Math.min(targets.length, 20), targets.length);

  const results = { matched: 0, noResult: 0, lowSim: 0, noLink: 0, failed: 0 };
  for (const p of targets.slice(0, max)) {
    console.log(`\n▶ [쿠팡 ${p.price ? p.price.toLocaleString("ko-KR") + "원" : "가격없음"}] ${p.title}`);
    try {
      // 1차: 전체 제목 검색 → 결과 없으면 앞 5개 토큰으로 재검색
      let candidates = await searchToss(page, p.title);
      if (candidates.length === 0) {
        const short = tokenize(p.title).slice(0, 5).join(" ");
        if (short && short !== p.title) candidates = await searchToss(page, short);
      }
      if (candidates.length === 0) {
        console.log("  ✘ 토스쇼핑 검색 결과 없음");
        results.noResult++;
        continue;
      }

      // 제목 유사도로 최적 후보 선택
      let best = null;
      let bestScore = 0;
      for (const c of candidates) {
        const s = similarity(p.title, c.title);
        if (s > bestScore) {
          bestScore = s;
          best = c;
        }
      }
      if (!best || bestScore < 0.45) {
        console.log(
          `  ↷ 동일 상품으로 보기 어려움 (최고 유사도 ${(bestScore * 100).toFixed(0)}%: ${best?.title?.slice(0, 40) || "-"})`
        );
        results.lowSim++;
        continue;
      }
      console.log(`  후보: ${best.title.slice(0, 50)} (유사도 ${(bestScore * 100).toFixed(0)}%)`);

      // 상세 페이지에서 가격 + 쉐어링크
      await page.goto(best.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);
      const info = await extractProduct(page);
      const { link } = await getSharelink(page, context);
      if (!link) {
        console.log("  ↷ 쉐어링크 없음 — 건너뜀");
        results.noLink++;
        continue;
      }

      await siteApi(config, "POST", "/api/admin/links", {
        productId: p.id,
        platform: "toss",
        url: link,
        price: info.price,
      });
      results.matched++;

      const diff =
        p.price && info.price
          ? info.price < p.price
            ? ` → 토스가 ${(p.price - info.price).toLocaleString("ko-KR")}원 저렴 🔵`
            : info.price > p.price
              ? ` → 쿠팡이 ${(info.price - p.price).toLocaleString("ko-KR")}원 저렴 🔴`
              : " → 동일 가격"
          : "";
      console.log(
        `  ✔ 토스 링크 추가 완료 [토스 ${info.price ? info.price.toLocaleString("ko-KR") + "원" : "가격 미확인"}]${diff}`
      );
    } catch (e) {
      console.log(`  ✘ 실패: ${e.message}`);
      results.failed++;
    }
  }

  console.log(
    `\n===== 매칭 결과 =====\n` +
      `  ✔ 토스 링크 추가: ${results.matched}개\n` +
      `  검색 결과 없음: ${results.noResult}개 / 유사도 낮음: ${results.lowSim}개 / ` +
      `쉐어링크 실패: ${results.noLink}개 / 오류: ${results.failed}개`
  );
}

/* ---------- 모드 2: 목록 수집 신규 등록 ---------- */

async function runImport(config, page, context) {
  console.log(
    "\n브라우저에서 등록하고 싶은 상품이 보이는 목록 페이지(홈/카테고리/기획전)로 이동하세요."
  );
  await rl.question("준비되면 엔터: ");

  const maxStr = (await rl.question("몇 개까지 수집할까요? (기본 15, 최대 30): ")).trim();
  const max = Math.min(Number(maxStr) || 15, 30);
  const urls = await page.evaluate((limit) => {
    const seen = new Set();
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/t/"]')) {
      const m = (a.getAttribute("href") || "").match(/\/t\/(\d+)/);
      if (!m || seen.has(m[1])) continue;
      seen.add(m[1]);
      out.push(`https://toss.shopping/t/${m[1]}`);
      if (out.length >= limit) break;
    }
    return out;
  }, max);
  console.log(`현재 페이지에서 상품 ${urls.length}개를 찾았습니다.`);
  if (urls.length === 0) return;

  const items = [];
  for (const url of urls) {
    console.log(`\n▶ ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);
      const info = await extractProduct(page);
      console.log(
        `  ${info.title || "(제목 실패)"}` +
          (info.price ? ` — ${info.price.toLocaleString("ko-KR")}원` : "") +
          (info.rating ? ` ⭐${info.rating}(${info.ratingCount ?? "?"})` : "")
      );
      const { link } = await getSharelink(page, context);
      if (!link) {
        console.log("  ↷ 쉐어링크 없음 — 건너뜀");
        continue;
      }
      items.push({
        title: info.title || url,
        imageUrl: info.imageUrl,
        price: info.price,
        rating: info.rating,
        ratingCount: info.ratingCount,
        description: "토스쇼핑 추천 상품",
        links: [{ platform: "toss", url: link, price: info.price }],
      });
    } catch (e) {
      console.log(`  ✘ 실패: ${e.message}`);
    }
  }
  if (items.length === 0) {
    console.log("\n등록할 상품이 없습니다.");
    return;
  }

  console.log("");
  CATEGORIES.forEach((c, i) => console.log(`  ${i + 1}) ${c}`));
  let cat = "기타";
  while (true) {
    const sel = (await rl.question("카테고리 번호 선택: ")).trim();
    const n = Number(sel);
    if (Number.isInteger(n) && n >= 1 && n <= CATEGORIES.length) {
      cat = CATEGORIES[n - 1];
      break;
    }
  }
  const dealAns = (await rl.question("'오늘의 딜'로 표시할까요? (y/N): ")).trim().toLowerCase();
  for (const it of items) {
    it.category = cat;
    it.isDeal = dealAns === "y";
  }
  const data = await siteApi(config, "POST", "/api/admin/products", items);
  console.log(`✔ ${data.created}개 상품 등록 완료!`);
}

/* ---------- 메인 ---------- */

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "\nPlaywright가 설치되어 있지 않습니다:\n  npm i -D playwright && npx playwright install chromium\n"
    );
    process.exit(1);
  }

  const config = await loadConfig();

  console.log("\n브라우저를 여는 중... (로그인이 안 되어 있으면 창에서 직접 로그인하세요)");
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ["--lang=ko-KR"],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto("https://toss.shopping/", { waitUntil: "domcontentloaded" });

  const mode = (
    await rl.question(
      "\n모드 선택 — 1) 쿠팡 상품과 매칭해 토스 가격비교 링크 붙이기(기본)  2) 토스 목록에서 신규 등록: "
    )
  ).trim();

  try {
    if (mode === "2") await runImport(config, page, context);
    else await runMatch(config, page, context);
  } finally {
    await context.close().catch(() => {});
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("오류:", e);
  process.exit(1);
});
