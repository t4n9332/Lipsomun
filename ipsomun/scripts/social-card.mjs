/**
 * 인스타그램·스레드용 가격비교 카드 이미지 자동 생성
 * - 그날 절약액이 큰 가격비교 상품으로 1080×1350 카드 PNG 생성
 * - 결과: ../../소셜카드/카드-YYYY-MM-DD-상품명.png
 * - 실행:  node scripts/social-card.mjs        (1장)
 *          node scripts/social-card.mjs 3      (3장)
 * - 매일 자동 실행(toss-auto.bat)에서 1장씩 생성됩니다.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const DONE_PATH = path.join(__dirname, ".social-done.json");
const OUT_DIR = path.join(__dirname, "..", "..", "소셜카드");
const COUNT = Math.min(Number(process.argv[2]) || 1, 5);

if (!existsSync(CONFIG_PATH)) {
  console.error("설정 파일(.toss-config.json)이 없습니다.");
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const token = createHash("sha256").update("ipsomun:" + config.adminPassword).digest("hex");
const won = (n) => Number(n).toLocaleString("ko-KR") + "원";
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function loadDone() {
  try {
    return JSON.parse(readFileSync(DONE_PATH, "utf8"));
  } catch {
    return [];
  }
}

function cardHtml({ title, imageUrl, coupang, toss, savings }) {
  const cheaper = toss < coupang ? "토스쇼핑" : "쿠팡";
  const cheaperColor = toss < coupang ? "#2f9cf4" : "#c9302c";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1080px; height:1350px; font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;
    background:linear-gradient(160deg,#eef4ff,#ffffff 45%,#fff1e8); display:flex; flex-direction:column;
    align-items:center; padding:70px 60px; }
  .brand { font-size:34px; font-weight:bold; color:#e8590c; }
  .brand span { color:#1a1a1a; }
  .head { font-size:52px; font-weight:900; margin:30px 0 10px; letter-spacing:-1px; }
  .sub { font-size:28px; color:#55524d; }
  .img { width:560px; height:560px; background:#fff; border-radius:36px; border:3px solid #e8e5e0;
    margin:44px 0; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .img img { width:100%; height:100%; object-fit:contain; }
  .title { font-size:34px; font-weight:bold; text-align:center; line-height:1.4; max-width:900px;
    overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .prices { display:flex; gap:26px; margin:40px 0 20px; }
  .p { border-radius:24px; padding:26px 44px; text-align:center; border:3px solid #e8e5e0; background:#fff; }
  .p.win { border-color:${cheaperColor}; box-shadow:0 10px 34px ${cheaperColor}33; }
  .p .n { font-size:26px; font-weight:bold; color:#8a867f; }
  .p.win .n { color:${cheaperColor}; }
  .p .v { font-size:46px; font-weight:900; margin-top:6px; }
  .save { background:${cheaperColor}; color:#fff; font-size:38px; font-weight:900;
    border-radius:999px; padding:20px 52px; margin-top:16px; }
  .foot { margin-top:auto; font-size:26px; color:#55524d; text-align:center; line-height:1.6; }
  .foot b { color:#2f9cf4; }
</style></head><body>
  <div class="brand">입<span>소문</span> 가격비교</div>
  <div class="head">같은 상품, 가격은 다르다</div>
  <div class="sub">오늘의 쿠팡 vs 토스쇼핑 실측 비교</div>
  <div class="img">${imageUrl ? `<img src="${imageUrl}">` : "🛍️"}</div>
  <div class="title">${title}</div>
  <div class="prices">
    <div class="p ${coupang <= toss ? "win" : ""}"><div class="n">쿠팡</div><div class="v">${won(coupang)}</div></div>
    <div class="p ${toss < coupang ? "win" : ""}"><div class="n">토스쇼핑</div><div class="v">${won(toss)}</div></div>
  </div>
  <div class="save">${cheaper}이 ${won(savings)} 저렴!</div>
  <div class="foot">매일 특가 브리핑 → 텔레그램 <b>t.me/cheapicker</b><br>실시간 비교는 lipsomun.co.kr</div>
</body></html>`;
}

async function main() {
  const res = await fetch(`${config.siteUrl}/api/admin/products?limit=1000`, {
    headers: { Cookie: `ipsomun_admin=${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 오류 ${res.status}`);

  const done = loadDone();
  const candidates = data.products
    .filter((p) => p.isPublished && !done.includes(p.slug))
    .map((p) => {
      const c = p.links.find((l) => l.platform === "coupang");
      const t = p.links.find((l) => l.platform === "toss");
      const coupang = c ? (c.price ?? p.price) : null;
      const toss = t ? t.price : null;
      return { p, coupang, toss };
    })
    .filter((x) => x.coupang != null && x.toss != null && x.coupang !== x.toss)
    .sort((a, b) => Math.abs(b.coupang - b.toss) - Math.abs(a.coupang - a.toss));

  if (candidates.length === 0) {
    console.log("카드로 만들 새 가격비교 상품이 없습니다.");
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const { chromium } = await import(
    pathToFileURL(path.join(__dirname, "..", "node_modules", "playwright", "index.mjs")).href
  );
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });

  for (const { p, coupang, toss } of candidates.slice(0, COUNT)) {
    // 상품 이미지: 공개 상품 페이지의 og:image 사용 (GET API에는 이미지가 없음)
    let imageUrl = "";
    try {
      const ph = await (await fetch(`${config.siteUrl}/p/${encodeURIComponent(p.slug)}`)).text();
      imageUrl =
        (ph.match(/property="og:image"[^>]*content="([^"]*)"/) ||
          ph.match(/content="([^"]*)"[^>]*property="og:image"/) ||
          [])[1] || "";
    } catch {}
    const html = cardHtml({
      title: p.title,
      imageUrl,
      coupang,
      toss,
      savings: Math.abs(coupang - toss),
    });
    await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
    const safe = p.title.split(",")[0].trim().replace(/[\\/:*?"<>|]/g, "").slice(0, 25);
    const out = path.join(OUT_DIR, `카드-${today}-${safe}.png`);
    await page.screenshot({ path: out });
    done.push(p.slug);
    console.log(`✔ 카드 생성: ${out}`);
  }
  await browser.close();
  writeFileSync(DONE_PATH, JSON.stringify(done, null, 2));
}

main().catch((e) => {
  console.error("오류:", e.message || e);
  process.exit(1);
});
