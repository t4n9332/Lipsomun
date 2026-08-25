/**
 * 토스쇼핑 가격비교 매칭 도구 (쉐어링크 어드민 자동화)
 * ================================================
 * 핵심: 사이트에 이미 등록된 쿠팡 상품과 "동일한 상품"을 쉐어링크 어드민
 * (sharelink.toss.im) 상품 카탈로그에서 찾아, '링크 발급' 버튼을 자동 클릭해
 * 쉐어링크 + 토스 가격을 쿠팡 링크 바로 아래에 붙입니다.
 * → 상세 페이지에서 쿠팡/토스 가격비교 버튼이 나란히 표시됩니다.
 *
 * ※ 토스쇼핑(toss.shopping) 웹에는 로그인이 없으므로, 모든 작업은
 *    sharelink.toss.im (크리에이터 어드민) 안에서 처리합니다.
 *    링크 발급 버튼을 누르면 쉐어링크가 클립보드에 복사되는 동작을 이용합니다.
 *
 * 준비:
 *   node scripts/toss-login.mjs   ← 최초 1회 sharelink.toss.im 로그인 (프로필 저장)
 *
 * 실행:
 *   node scripts/toss-playwright.mjs              # 모드 선택 후 진행
 *   node scripts/toss-playwright.mjs --crawl-test # 카탈로그 수집만 테스트 (등록 안 함)
 *   node scripts/toss-playwright.mjs --match-only # 매칭·가격갱신만 (블로그·알림 없음)
 *
 * 모드:
 *   1) 쿠팡 상품 매칭 (기본) — 사이트에서 '쿠팡 링크는 있고 토스 링크는 없는' 상품을
 *      가져와 어드민 카탈로그(프로모션·베스트·하루특가)와 제목 유사도로 대조 →
 *      일치 상품만 링크 발급 → 사이트에 토스 링크+가격 자동 추가
 *   2) 카탈로그 신규 등록 — 어드민 카탈로그에서 상품을 골라 신규 등록
 */

import { createInterface } from "node:readline/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, ".toss-profile");
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const SHARELINK_RE = /https:\/\/toss\.im\/_m\/[A-Za-z0-9]+/;

/** 카탈로그를 수집할 어드민 페이지들 */
const CATALOG_PAGES = [
  { name: "프로모션 상품", url: "https://sharelink.toss.im/links/recommended-products" },
  { name: "베스트 랭킹", url: "https://sharelink.toss.im/links/best-ranking" },
  { name: "홈(하루특가)", url: "https://sharelink.toss.im/home" },
];

/** 한 회차에 시도할 역매칭(쿠팡 검색) 횟수 — 쿠팡 검색 API 시간당 약 10회 제한을 고려 */
const DISCOVER_PER_RUN = 8;

/** 역매칭 후보 가격 상한 — 이보다 비싼 상품은 쿠팡 제목 검색 매칭률이 낮다 */
const DISCOVER_MAX_PRICE = 200_000;

/** 정렬 점수에서 가격 기여분을 포화시키는 지점 (고가 상품 쏠림 방지) */
const DISCOVER_PRICE_CAP = 50_000;

/** 역매칭 실패 이력 저장 파일 — 같은 상품을 매 회차 재검색하며 쿼터를 낭비하지 않기 위함 */
const TRIED_PATH = path.join(__dirname, ".discover-tried.json");

/** 역매칭 실패 상품 재시도 유예기간(일) — 이 기간이 지나면 다시 후보에 오른다 */
const DISCOVER_RETRY_DAYS = 14;

/**
 * 토스 필터 카테고리 → 사이트 카테고리 매핑.
 * 역매칭 신규 등록이 전부 '기타'로 들어가는 것을 막는다 (사이트는 '기타' 0개 유지가 원칙).
 * 필터 없이 수집된 상품(프로모션·베스트·하루특가)과 매핑이 없는 필터는 '기타'로 남고,
 * 이후 apply-categories.mjs 재분류 도구로 정리한다.
 */
const TOSS_TO_SITE_CATEGORY = {
  식품: "식품",
  생활용품: "생활용품",
  뷰티: "뷰티",
  "가전/디지털": "가전/디지털",
  주방용품: "주방용품",
  "출산/유아동": "육아",
  "반려/애완용품": "반려동물",
  패션의류잡화: "패션",
  "스포츠/레져": "스포츠/레저",
  "가구/홈데코": "홈인테리어",
};

/** 상품 조회 페이지 — 카테고리 필터를 적용해 카탈로그를 넓히는 데 쓴다 */
const FILTER_PAGE_URL = "https://sharelink.toss.im/links/recommended-products";

/** 쉐어링크 어드민의 카테고리 필터 항목 (사이트 카테고리와는 별개) */
const TOSS_FILTER_CATEGORIES = [
  "식품",
  "생활용품",
  "뷰티",
  "가전/디지털",
  "주방용품",
  "출산/유아동",
  "반려/애완용품",
  "패션의류잡화",
  "스포츠/레져",
  "가구/홈데코",
  "완구/취미",
  "문구/오피스",
  "자동차용품",
];

const CATEGORIES = [
  "가전/디지털", "생활용품", "주방용품", "식품", "뷰티", "패션",
  "홈인테리어", "스포츠/레저", "육아", "반려동물", "기타",
];

const rl = createInterface({ input: process.stdin, output: process.stdout });

/* ---------- 설정 / 사이트 API ---------- */

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
    headers: { "Content-Type": "application/json", Cookie: adminCookie(config) },
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

/** 자카드 유사도 + 숫자 토큰(용량·수량) 양방향 가중치 */
function similarity(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  const jaccard = inter / union;
  // 숫자 토큰(1000mg, 60정, 3개 등)은 양방향으로 비교 —
  // 한쪽 제목에만 있는 수량 표기도 "다른 옵션일 가능성"으로 감점
  // (예: "비타민C 1000" vs "비타민C 1000, 60정, 3개" → 수량이 달라도 걸러냄)
  const numsA = [...ta].filter((t) => /\d/.test(t));
  const numsB = [...tb].filter((t) => /\d/.test(t));
  const numUnion = new Set([...numsA, ...numsB]).size;
  const numInter = numsA.filter((t) => tb.has(t)).length;
  const numScore = numUnion === 0 ? 1 : numInter / numUnion;
  return jaccard * 0.7 + numScore * 0.3;
}

/** 두 플랫폼 가격이 2.2배 이상 차이나면 용량/구성이 다른 상품일 가능성이 높음 */
function priceRatioSuspicious(a, b) {
  if (a == null || b == null || a <= 0 || b <= 0) return false;
  return Math.max(a, b) / Math.min(a, b) > 2.2;
}

/** 발급된 쉐어링크가 실제 가리키는 상품 제목 (og:title) */
async function fetchSharelinkTitle(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    const html = (await res.text()).slice(0, 200_000);
    const m =
      html.match(/property="og:title"[^>]*content="([^"]*)"/) ||
      html.match(/content="([^"]*)"[^>]*property="og:title"/);
    return m ? m[1].replace(/\s*\|\s*토스쇼핑\s*$/, "").trim() : null;
  } catch {
    return null;
  }
}

/**
 * 발급 직후 검증: 링크가 실제로 클릭한 카탈로그 상품을 가리키는지 확인.
 * (클릭/클립보드가 어긋나 엉뚱한 상품 링크가 잡히는 사고 방지)
 */
async function verifyIssuedLink(link, expectedTitle) {
  const actual = await fetchSharelinkTitle(link);
  if (!actual) return { ok: false, actual: null }; // 확인 불가 시 부착하지 않음 (보수적)
  const sim = similarity(expectedTitle, actual);
  return { ok: sim >= 0.7, actual, sim };
}

/* ---------- 쉐어링크 어드민 조작 ---------- */

async function ensureLoggedIn(page) {
  await page.goto("https://sharelink.toss.im/home", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const ok = await page.evaluate(() => document.body.innerText.includes("실적 대시보드"));
  if (!ok) {
    throw new Error(
      "쉐어링크 어드민 로그인이 안 되어 있습니다. 먼저 실행하세요:  node scripts/toss-login.mjs"
    );
  }
}

/**
 * 현재 페이지에서 '링크 발급' 버튼이 달린 상품 행을 모두 수집.
 * 행 텍스트 예: 개당 1,178원 수익 | 동아오츠카 나랑드사이다..., 24개 | 11,780원 | 4.9 (2,438) | 링크 발급
 */
async function collectRows(page) {
  return page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].filter((b) =>
      b.textContent.includes("링크 발급")
    );
    const rows = [];
    btns.forEach((btn, idx) => {
      let row = btn;
      for (let i = 0; i < 8 && row.parentElement; i++) {
        row = row.parentElement;
        if (row.innerText.includes("원") && row.innerText.length > 30 && row.innerText.length < 500)
          break;
      }
      const lines = row.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
      const priceIdx = lines.findIndex((l) => /^[0-9][0-9,]*원$/.test(l));
      if (priceIdx < 1) return;
      const title = lines[priceIdx - 1];
      if (!title || title.length < 4 || title.includes("링크 발급")) return;
      const price = Number(lines[priceIdx].replace(/[^0-9]/g, "")) || null;
      let rating = null;
      let ratingCount = null;
      for (const l of lines) {
        const m = l.match(/^([0-5]\.\d)\s*\((\d[\d,]*)\)$/);
        if (m) {
          rating = Number(m[1]);
          ratingCount = Number(m[2].replace(/,/g, "")) || null;
          break;
        }
      }
      const img = row.querySelector("img");
      rows.push({
        btnIndex: idx,
        title: title.slice(0, 200),
        price,
        rating,
        ratingCount,
        imageUrl: img ? img.src : "",
      });
    });
    return rows;
  });
}

/** 같은 페이지에서 btnIndex의 '링크 발급' 버튼 클릭 → 클립보드에서 쉐어링크 회수 */
async function issueLinkByIndex(page, btnIndex) {
  await page.evaluate(() => navigator.clipboard.writeText("").catch(() => {}));
  const clicked = await page.evaluate((idx) => {
    const btns = [...document.querySelectorAll("button")].filter((b) =>
      b.textContent.includes("링크 발급")
    );
    if (!btns[idx]) return false;
    btns[idx].scrollIntoView({ block: "center" });
    btns[idx].click();
    return true;
  }, btnIndex);
  if (!clicked) return null;
  // 클립보드에 링크가 들어올 때까지 대기 (최대 6초)
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(500);
    const clip = await page
      .evaluate(() => navigator.clipboard.readText().catch(() => ""))
      .catch(() => "");
    const m = (clip || "").match(SHARELINK_RE);
    if (m) return m[0];
  }
  // 폴백: 모달 등 DOM에 노출된 링크
  const html = await page.content();
  const m = html.match(SHARELINK_RE);
  return m ? m[0] : null;
}

/**
 * 상품 조회 페이지에서 카테고리 필터 하나를 적용하고 상품 행을 수집.
 * 필터 상태가 남지 않도록 매번 페이지를 새로 연다.
 */
async function collectRowsWithCategory(page, category) {
  await page.goto(FILTER_PAGE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3500);

  // '카테고리' 필터 패널 열기
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => (x.textContent || "").trim() === "카테고리"
    );
    if (!b) return false;
    b.click();
    return true;
  });
  if (!opened) throw new Error("카테고리 필터 버튼을 찾지 못함");
  await page.waitForTimeout(1500);

  // 해당 카테고리 체크박스 선택
  const picked = await page.evaluate((cat) => {
    const l = [...document.querySelectorAll("label")].find(
      (x) => (x.textContent || "").trim() === cat
    );
    if (!l) return false;
    l.click();
    return true;
  }, category);
  if (!picked) throw new Error(`'${category}' 항목을 찾지 못함`);
  await page.waitForTimeout(2500);

  // 적용 버튼이 있으면 누르고, 없으면 패널만 닫는다
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => /^(적용|확인|검색)$/.test((x.textContent || "").trim()) && x.offsetParent
    );
    if (b) b.click();
  });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(3000);

  // 지연 로딩 대비 스크롤
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(800);
  }
  return collectRows(page);
}

/** 카탈로그 항목이 어느 화면 상태에서 수집됐는지 나타내는 키 (필터 포함) */
function pageKey(cat) {
  return `${cat.pageUrl}|${cat.filterCategory || ""}`;
}

/**
 * 카탈로그 항목이 수집됐던 화면을 그대로 다시 열고 행 목록을 반환.
 * 필터로 수집한 항목이면 같은 카테고리 필터를 다시 적용한다.
 */
async function openCatalogPage(page, cat) {
  if (cat.filterCategory) return collectRowsWithCategory(page, cat.filterCategory);
  await page.goto(cat.pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(600);
  }
  return collectRows(page);
}

/** 카탈로그 페이지 전체 수집 (페이지명 포함, 제목으로 중복 제거) */
async function crawlCatalog(page) {
  const catalog = [];
  const seen = new Set();
  for (const cp of CATALOG_PAGES) {
    try {
      await page.goto(cp.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(4000);
      // 지연 로딩 대비 스크롤
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 4000);
        await page.waitForTimeout(800);
      }
      const rows = await collectRows(page);
      let added = 0;
      for (const r of rows) {
        if (seen.has(r.title)) continue;
        seen.add(r.title);
        catalog.push({ ...r, pageUrl: cp.url, pageName: cp.name });
        added++;
      }
      console.log(`  [${cp.name}] 상품 ${rows.length}개 수집 (신규 ${added}개)`);
    } catch (e) {
      console.log(`  [${cp.name}] 수집 실패: ${e.message}`);
    }
  }

  // 상품 조회 페이지의 카테고리 필터를 순회해 카탈로그를 넓힌다.
  // (필터 없이 보이는 목록은 100여 개뿐이지만, 카테고리별로 다른 상품이 노출된다)
  for (const cat of TOSS_FILTER_CATEGORIES) {
    try {
      const rows = await collectRowsWithCategory(page, cat);
      let added = 0;
      for (const r of rows) {
        if (seen.has(r.title)) continue;
        seen.add(r.title);
        catalog.push({
          ...r,
          pageUrl: FILTER_PAGE_URL,
          pageName: `상품조회:${cat}`,
          filterCategory: cat, // 발급 단계에서 같은 필터를 다시 적용해야 행을 찾을 수 있다
        });
        added++;
      }
      console.log(`  [상품조회/${cat}] 상품 ${rows.length}개 수집 (신규 ${added}개)`);
    } catch (e) {
      console.log(`  [상품조회/${cat}] 수집 실패: ${e.message}`);
    }
  }
  return catalog;
}

/* ---------- 모드 1: 쿠팡 상품 매칭 (핵심) ---------- */

async function runMatch(config, page, opts = {}) {
  const auto = !!opts.auto;
  console.log("\n사이트에서 상품 목록을 가져오는 중...");
  const { products } = await siteApi(config, "GET", "/api/admin/products?limit=1000");
  const targets = products.filter(
    (p) =>
      p.isPublished &&
      p.links.some((l) => l.platform === "coupang") &&
      !p.links.some((l) => l.platform === "toss")
  );
  console.log(`전체 ${products.length}개 중 매칭 대상(쿠팡 O, 토스 X): ${targets.length}개`);

  let catalog = opts.catalog;
  if (!catalog) {
    console.log("\n쉐어링크 어드민 카탈로그를 수집하는 중...");
    catalog = await crawlCatalog(page);
  }
  console.log(`카탈로그 상품 총 ${catalog.length}개\n`);
  if (targets.length === 0) {
    console.log("매칭할 상품이 없습니다.");
    return { products, catalog, added: 0 };
  }

  // 상품별 최적 후보 계산
  const matches = [];
  for (const t of targets) {
    let best = null;
    let bestScore = 0;
    for (const c of catalog) {
      const s = similarity(t.title, c.title);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (!best || bestScore < 0.45) continue;
    if (priceRatioSuspicious(t.price, best.price)) {
      console.log(
        `  ⚠ 가격차 과다로 제외(용량 다를 가능성): ${t.title.slice(0, 34)} (쿠팡 ${t.price?.toLocaleString("ko-KR")}원 vs 토스 ${best.price?.toLocaleString("ko-KR")}원)`
      );
      continue;
    }
    matches.push({ target: t, cat: best, score: bestScore });
  }
  console.log(`제목 유사도 45% 이상 일치: ${matches.length}쌍`);
  if (matches.length === 0) {
    console.log("일치하는 상품이 없습니다. (토스 카탈로그는 프로모션/베스트 위주라 겹치는 상품이 적을 수 있어요)");
    return { products, catalog, added: 0 };
  }
  for (const m of matches) {
    console.log(
      `  · [${(m.score * 100).toFixed(0)}%] ${m.target.title.slice(0, 40)}\n` +
        `      ↔ ${m.cat.title.slice(0, 40)} (${m.cat.pageName})`
    );
  }
  if (!auto) {
    const go = (
      await rl.question(`\n위 ${matches.length}쌍에 대해 링크 발급 + 사이트 등록을 진행할까요? (Y/n): `)
    )
      .trim()
      .toLowerCase();
    if (go === "n") return { products, catalog, added: 0 };
  }

  // 페이지별로 묶어서 발급 (버튼 인덱스는 페이지 로드 기준이므로 같은 페이지에서 처리)
  // 카테고리 필터로 수집한 상품은 같은 필터를 다시 적용해야 행이 보인다.
  const byPage = new Map();
  for (const m of matches) {
    const key = pageKey(m.cat);
    const arr = byPage.get(key) || [];
    arr.push(m);
    byPage.set(key, arr);
  }

  let done = 0;
  let failed = 0;
  for (const [, group] of byPage) {
    // 버튼 인덱스가 어긋났을 수 있으니 제목 기준으로 다시 찾기
    const rows = await openCatalogPage(page, group[0].cat);
    for (const m of group) {
      const row = rows.find((r) => r.title === m.cat.title);
      if (!row) {
        console.log(`  ✘ [${m.cat.title.slice(0, 30)}] 페이지에서 행을 다시 찾지 못함`);
        failed++;
        continue;
      }
      try {
        const link = await issueLinkByIndex(page, row.btnIndex);
        if (!link) {
          console.log(`  ✘ [${m.cat.title.slice(0, 30)}] 링크 발급 실패`);
          failed++;
          continue;
        }
        // 발급된 링크가 진짜 그 상품을 가리키는지 실체 검증
        const v = await verifyIssuedLink(link, m.cat.title);
        if (!v.ok) {
          console.log(
            `  ✘ [${m.cat.title.slice(0, 30)}] 링크 검증 실패 — 실제 상품: ${v.actual?.slice(0, 35) ?? "확인 불가"} (부착 안 함)`
          );
          failed++;
          continue;
        }
        await siteApi(config, "POST", "/api/admin/links", {
          productId: m.target.id,
          platform: "toss",
          url: link,
          price: m.cat.price,
        });
        done++;
        const diff =
          m.target.price && m.cat.price
            ? m.cat.price < m.target.price
              ? ` → 토스가 ${(m.target.price - m.cat.price).toLocaleString("ko-KR")}원 저렴 🔵`
              : m.cat.price > m.target.price
                ? ` → 쿠팡이 ${(m.cat.price - m.target.price).toLocaleString("ko-KR")}원 저렴 🔴`
                : " → 동일 가격"
            : "";
        console.log(
          `  ✔ ${m.target.title.slice(0, 36)} [토스 ${m.cat.price ? m.cat.price.toLocaleString("ko-KR") + "원" : "?"}]${diff}`
        );
        await page.waitForTimeout(800);
      } catch (e) {
        console.log(`  ✘ [${m.cat.title.slice(0, 30)}] ${e.message}`);
        failed++;
      }
    }
  }
  console.log(`\n===== 매칭 결과: 토스 링크 추가 ${done}개, 실패 ${failed}개 =====`);
  return { products, catalog, added: done };
}

/* ---------- 자동 모드 2단계: 토스 인기상품 → 쿠팡 역매칭 신규 등록 ---------- */

/**
 * 토스 카탈로그 중 사이트에 아직 없는 상품을 쿠팡 검색 API로 역매칭.
 * 양쪽에서 모두 팔리는 상품이면 쿠팡+토스 링크를 모두 가진 신규 상품으로 등록
 * → 홈 '가격비교' 섹션에 노출됨.
 * ⚠️ 쿠팡 검색 API는 시간당 약 10회 제한 → 한 번에 최대 maxSearches개만 시도.
 */
async function runDiscover(config, page, catalog, products, maxSearches = 5) {
  // 이미 사이트에 있는(비슷한 제목) 카탈로그 상품 제외.
  //
  // 정렬 기준: 쿠팡 검색 API 호출이 시간당 10회로 제한되므로, 한 번의 검색이
  // 실제 등록으로 이어질 확률이 높은 상품부터 시도해야 한다.
  // - 리뷰 수가 많다 = 대중적인 상품 = 쿠팡에도 같은 상품이 있을 확률이 높다
  // - 가격은 수수료와 직결되지만, 고가 전자제품은 제목이 제각각이라 매칭이 거의 안 된다
  //   → 가격 기여분은 5만원에서 포화시키고, 20만원 초과 상품은 후보에서 제외
  const revenueScore = (c) =>
    Math.log10((c.ratingCount ?? 0) + 10) * Math.min(c.price ?? 0, DISCOVER_PRICE_CAP);

  // 최근 검색했던 후보는 유예기간 동안 제외 — 이 기록이 없으면 매 회차 동일한
  // 상위 후보를 재검색하며 시간당 10회뿐인 쿠팡 쿼터를 전부 재실패에 낭비한다
  // (실제 사고: 카탈로그 확장 후 3회차 연속 같은 8개 검색 → 신규 등록 0).
  let triedLog = {};
  try {
    triedLog = JSON.parse(readFileSync(TRIED_PATH, "utf8"));
  } catch {}
  const retryCutoff = Date.now() - DISCOVER_RETRY_DAYS * 24 * 3600 * 1000;

  const fresh = catalog
    .filter((c) => c.price != null && c.price <= DISCOVER_MAX_PRICE)
    .filter((c) => !(triedLog[c.title] > retryCutoff))
    .filter((c) => !products.some((p) => similarity(p.title, c.title) >= 0.6))
    .sort((a, b) => revenueScore(b) - revenueScore(a));

  console.log(
    `\n[역매칭] 사이트에 없는 토스 인기상품 ${fresh.length}개 중 상위 ${Math.min(maxSearches, fresh.length)}개를 쿠팡에서 검색합니다.`
  );

  let created = 0;
  let tried = 0;
  for (const c of fresh) {
    if (tried >= maxSearches) break;
    tried++;
    // 성공·실패 무관하게 기록 — 성공한 상품은 사이트에 등록되므로 어차피 재후보가 안 되고,
    // 실패한 상품은 유예기간 동안 다른 후보에게 검색 기회를 넘긴다
    triedLog[c.title] = Date.now();
    const keyword = tokenize(c.title).slice(0, 6).join(" ");
    try {
      const { products: found } = await siteApi(
        config,
        "GET",
        `/api/admin/coupang/search?keyword=${encodeURIComponent(keyword)}&limit=5`
      );
      let best = null;
      let bestScore = 0;
      for (const f of found || []) {
        const s = similarity(c.title, f.productName);
        if (s > bestScore) {
          bestScore = s;
          best = f;
        }
      }
      if (!best || bestScore < 0.45) {
        console.log(`  ↷ [${c.title.slice(0, 34)}] 쿠팡에서 동일 상품 못 찾음 (${(bestScore * 100).toFixed(0)}%)`);
        continue;
      }
      if (priceRatioSuspicious(best.productPrice, c.price)) {
        console.log(
          `  ⚠ [${c.title.slice(0, 34)}] 가격차 과다로 제외 (쿠팡 ${best.productPrice?.toLocaleString("ko-KR")}원 vs 토스 ${c.price?.toLocaleString("ko-KR")}원)`
        );
        continue;
      }
      // 토스 쉐어링크 발급 (필터로 수집한 상품이면 같은 필터를 다시 적용)
      const rows = await openCatalogPage(page, c);
      const row = rows.find((r) => r.title === c.title);
      const link = row ? await issueLinkByIndex(page, row.btnIndex) : null;
      if (!link) {
        console.log(`  ✘ [${c.title.slice(0, 34)}] 쉐어링크 발급 실패`);
        continue;
      }
      const v = await verifyIssuedLink(link, c.title);
      if (!v.ok) {
        console.log(
          `  ✘ [${c.title.slice(0, 34)}] 링크 검증 실패 — 실제 상품: ${v.actual?.slice(0, 35) ?? "확인 불가"} (등록 안 함)`
        );
        continue;
      }
      await siteApi(config, "POST", "/api/admin/products", [
        {
          title: c.title,
          imageUrl: c.imageUrl || best.productImage || "",
          price: best.productPrice ?? null,
          category: TOSS_TO_SITE_CATEGORY[c.filterCategory] || "기타",
          isDeal: false,
          isPublished: true,
          source: "toss-match",
          description: "쿠팡·토스 가격비교 상품",
          rating: c.rating,
          ratingCount: c.ratingCount,
          links: [
            { platform: "coupang", url: best.productUrl, price: best.productPrice ?? null },
            { platform: "toss", url: link, price: c.price },
          ],
        },
      ]);
      created++;
      const diff =
        best.productPrice && c.price
          ? c.price < best.productPrice
            ? `토스가 ${(best.productPrice - c.price).toLocaleString("ko-KR")}원 저렴 🔵`
            : c.price > best.productPrice
              ? `쿠팡이 ${(c.price - best.productPrice).toLocaleString("ko-KR")}원 저렴 🔴`
              : "동일 가격"
          : "";
      console.log(
        `  ✔ 신규 등록: ${c.title.slice(0, 34)} [쿠팡 ${best.productPrice?.toLocaleString("ko-KR")}원 vs 토스 ${c.price?.toLocaleString("ko-KR")}원] ${diff}`
      );
      await page.waitForTimeout(800);
    } catch (e) {
      console.log(`  ✘ [${c.title.slice(0, 30)}] ${e.message}`);
      if (String(e.message).includes("429") || String(e.message).includes("제한")) {
        console.log("  쿠팡 API 호출 제한으로 역매칭을 중단합니다.");
        break;
      }
    }
  }
  // 유예기간 지난 항목은 정리하고 저장
  const pruned = Object.fromEntries(
    Object.entries(triedLog).filter(([, ts]) => ts > retryCutoff)
  );
  try {
    writeFileSync(TRIED_PATH, JSON.stringify(pruned, null, 2));
  } catch (e) {
    console.log(`  ⚠ 검색 이력 저장 실패: ${e.message}`);
  }
  console.log(`[역매칭] 신규 가격비교 상품 ${created}개 등록 (검색 ${tried}회 사용)`);
  return created;
}

/* ---------- 자동 모드 3단계: 기존 토스 링크 가격 갱신 ---------- */

/**
 * 이미 토스 링크가 붙은 상품의 가격을 오늘 카탈로그 기준으로 갱신.
 * (오래된 가격은 방문자 신뢰를 떨어뜨림 — 링크 URL은 그대로 유지, 가격만 교체)
 */
async function runPriceRefresh(config, catalog, products) {
  let updated = 0;
  for (const p of products) {
    const tossLink = p.links.find((l) => l.platform === "toss");
    if (!tossLink) continue;
    // 갱신은 오매칭 방지를 위해 더 엄격한 유사도(60%)로만
    let best = null;
    let bestScore = 0;
    for (const c of catalog) {
      const s = similarity(p.title, c.title);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (!best || bestScore < 0.6 || best.price == null) continue;
    if (tossLink.price === best.price) continue;
    if (priceRatioSuspicious(p.price, best.price)) continue;
    try {
      await siteApi(config, "POST", "/api/admin/links", {
        productId: p.id,
        platform: "toss",
        url: tossLink.url,
        price: best.price,
      });
      updated++;
      console.log(
        `  ↻ 가격 갱신: ${p.title.slice(0, 34)} 토스 ${tossLink.price?.toLocaleString("ko-KR") ?? "?"}원 → ${best.price.toLocaleString("ko-KR")}원`
      );
    } catch (e) {
      console.log(`  ✘ 갱신 실패 [${p.title.slice(0, 30)}]: ${e.message}`);
    }
  }
  console.log(`[가격 갱신] 토스 가격 ${updated}개 업데이트`);
  return updated;
}

/* ---------- 모드 2: 카탈로그 신규 등록 ---------- */

async function runImport(config, page) {
  console.log("\n쉐어링크 어드민 카탈로그를 수집하는 중...");
  const catalog = await crawlCatalog(page);
  if (catalog.length === 0) {
    console.log("수집된 상품이 없습니다.");
    return;
  }
  console.log("");
  catalog.slice(0, 60).forEach((c, i) => {
    console.log(
      `  ${i + 1}) ${c.title.slice(0, 44)} — ${c.price ? c.price.toLocaleString("ko-KR") + "원" : "?"}` +
        (c.rating ? ` ⭐${c.rating}(${c.ratingCount ?? "?"})` : "") +
        ` [${c.pageName}]`
    );
  });
  const sel = (await rl.question("\n등록할 번호를 쉼표로 입력 (예: 1,3,5 / 상위 10개는 t10): ")).trim();
  let chosen = [];
  const tm = sel.toLowerCase().match(/^t(\d+)$/);
  if (tm) chosen = catalog.slice(0, Number(tm[1]));
  else {
    for (const s of sel.split(",")) {
      const n = Number(s.trim());
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(catalog.length, 60))
        chosen.push(catalog[n - 1]);
    }
  }
  if (chosen.length === 0) {
    console.log("선택된 상품이 없습니다.");
    return;
  }

  console.log("");
  CATEGORIES.forEach((c, i) => console.log(`  ${i + 1}) ${c}`));
  let cat = "기타";
  while (true) {
    const s = (await rl.question("카테고리 번호 선택: ")).trim();
    const n = Number(s);
    if (Number.isInteger(n) && n >= 1 && n <= CATEGORIES.length) {
      cat = CATEGORIES[n - 1];
      break;
    }
  }
  const dealAns = (await rl.question("'오늘의 딜'로 표시할까요? (y/N): ")).trim().toLowerCase();

  // 페이지(+필터)별로 묶어서 발급
  const byPage = new Map();
  for (const c of chosen) {
    const key = pageKey(c);
    const arr = byPage.get(key) || [];
    arr.push(c);
    byPage.set(key, arr);
  }
  const items = [];
  for (const [, group] of byPage) {
    const rows = await openCatalogPage(page, group[0]);
    for (const c of group) {
      const row = rows.find((r) => r.title === c.title);
      if (!row) {
        console.log(`  ✘ [${c.title.slice(0, 30)}] 행을 다시 찾지 못함`);
        continue;
      }
      const link = await issueLinkByIndex(page, row.btnIndex);
      if (!link) {
        console.log(`  ✘ [${c.title.slice(0, 30)}] 링크 발급 실패`);
        continue;
      }
      const v = await verifyIssuedLink(link, c.title);
      if (!v.ok) {
        console.log(
          `  ✘ [${c.title.slice(0, 30)}] 링크 검증 실패 — 실제 상품: ${v.actual?.slice(0, 35) ?? "확인 불가"} (건너뜀)`
        );
        continue;
      }
      console.log(`  ✔ ${c.title.slice(0, 40)} → ${link}`);
      items.push({
        title: c.title,
        imageUrl: c.imageUrl,
        price: c.price,
        rating: c.rating,
        ratingCount: c.ratingCount,
        category: cat,
        isDeal: dealAns === "y",
        description: c.pageName === "홈(하루특가)" ? "토스쇼핑 하루특가" : "토스쇼핑 추천 상품",
        links: [{ platform: "toss", url: link, price: c.price }],
      });
      await page.waitForTimeout(800);
    }
  }
  if (items.length === 0) {
    console.log("\n등록할 상품이 없습니다.");
    return;
  }
  const data = await siteApi(config, "POST", "/api/admin/products", items);
  console.log(`\n✔ ${data.created}개 상품 등록 완료!`);
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

  const crawlTest = process.argv.includes("--crawl-test");
  const auto = process.argv.includes("--auto");
  const matchOnly = process.argv.includes("--match-only");

  if (auto && !existsSync(CONFIG_PATH)) {
    console.error(
      "자동 모드는 설정 파일(.toss-config.json)이 필요합니다. 먼저 대화형으로 1회 실행해 비밀번호를 저장하세요."
    );
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: crawlTest || auto || matchOnly, // 테스트·자동 모드는 헤드리스, 대화형은 창 표시
    viewport: { width: 1280, height: 900 },
    args: ["--lang=ko-KR"],
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    await ensureLoggedIn(page);

    if (crawlTest) {
      console.log("\n[카탈로그 수집 테스트]");
      const catalog = await crawlCatalog(page);
      console.log(`\n총 ${catalog.length}개. 샘플 5개:`);
      catalog.slice(0, 5).forEach((c) =>
        console.log(
          `  · ${c.title} — ${c.price?.toLocaleString("ko-KR")}원` +
            (c.rating ? ` ⭐${c.rating}(${c.ratingCount})` : "") +
            ` [${c.pageName}]`
        )
      );
      return;
    }

    if (matchOnly) {
      // 매칭·역매칭·가격갱신만 실행 (블로그 발행·텔레그램 발송 없음).
      // 하루 중 여러 번 돌려 가격비교 상품을 늘리는 용도.
      console.log(`\n[매칭 전용 실행] ${new Date().toLocaleString("ko-KR")}`);
      const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      const r = await runMatch(config, page, { auto: true });
      if (r) {
        await runDiscover(config, page, r.catalog, r.products, DISCOVER_PER_RUN);
        await runPriceRefresh(config, r.catalog, r.products);
      }
      console.log("[매칭 전용 실행] 완료\n");
      return;
    }

    if (auto) {
      // 완전 자동: ① 기존 쿠팡 상품 매칭 → ② 토스 인기상품 쿠팡 역매칭 신규 등록
      console.log(`\n[자동 실행] ${new Date().toLocaleString("ko-KR")}`);
      const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      const r = await runMatch(config, page, { auto: true });
      if (r) {
        await runDiscover(config, page, r.catalog, r.products, DISCOVER_PER_RUN);
        await runPriceRefresh(config, r.catalog, r.products);
      }
      // 그날 데이터로 블로그 리포트 자동 발행 (하루 1개, 이미 있으면 건너뜀)
      try {
        const b = await siteApi(config, "GET", "/api/cron/blogpost");
        console.log(`[블로그] ${b.message}`);
      } catch (e) {
        console.log(`[블로그] 발행 실패: ${e.message}`);
      }
      // 텔레그램 다이제스트 + 역대최저가 푸시
      try {
        const n = await siteApi(config, "GET", "/api/cron/notify");
        console.log(`[알림] ${n.message}`);
      } catch (e) {
        console.log(`[알림] 실패: ${e.message}`);
      }
      console.log("[자동 실행] 완료\n");
      return;
    }

    const config = await loadConfig();
    const mode = (
      await rl.question(
        "\n모드 선택 — 1) 쿠팡 상품과 매칭해 토스 가격비교 링크 붙이기(기본)  2) 카탈로그에서 신규 등록: "
      )
    ).trim();
    if (mode === "2") await runImport(config, page);
    else await runMatch(config, page);
  } finally {
    // context.close()가 간혹 응답 없는 크로미움 프로세스 때문에 무한 대기하는 경우가 있어
    // 타임아웃을 두고 강제로 넘어간다 (실제 사고: 9:30 회차가 5시간 동안 좀비 프로세스로 남아
    // 다음 회차의 로그 파일 append를 막아 13:30 회차가 통째로 실패함).
    await Promise.race([
      context.close().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 15000)),
    ]);
    // close가 실패했으면 크로미움이 고아로 남아 상속받은 로그 파일 핸들을 계속 잡는다
    // (실제 사고: 17:30 회차의 고아 크로미움이 21:30 회차의 로그 append를 막아 실패).
    // .toss-profile을 쓰는 프로세스만 정리하므로 사용자의 실제 크롬은 건드리지 않는다.
    spawnSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*.toss-profile*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    ], { timeout: 20000 });
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("오류:", e.message || e);
  process.exit(1);
});
