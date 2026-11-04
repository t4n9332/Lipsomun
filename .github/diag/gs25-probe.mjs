// 임시 진단 2: 우리동네GS 공식 웹(woodongs.com)에 로그인 없이 공개된 GS25 행사상품 화면·데이터가 있는지.
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  locale: "ko-KR",
  viewport: { width: 420, height: 900 },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

async function probe(url, label) {
  const page = await ctx.newPage();
  const calls = [];
  page.on("response", async (r) => {
    const t = r.request().resourceType();
    if (!["xhr", "fetch", "document"].includes(t)) return;
    const ct = r.headers()["content-type"] || "";
    let sample = "";
    try { if (/json/.test(ct)) sample = (await r.text()).slice(0, 400).replace(/\s+/g, " "); } catch {}
    calls.push(`${t} ${r.request().method()} ${r.status()} ${r.url().slice(0, 200)} [${ct.split(";")[0]}] ${sample}`);
  });
  try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 }); } catch (e) { console.log(`!! ${url}: ${e.message.slice(0, 100)}`); }
  await page.waitForTimeout(8000);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(1200); }
  console.log(`\n==== [${label}] ${url} → ${page.url()} | ${await page.title()}`);
  const text = (await page.evaluate(() => document.body?.innerText || "")).replace(/\s+/g, " ");
  console.log(`본문(앞 600자): ${text.slice(0, 600)}`);
  for (const c of calls.slice(0, 50)) console.log(`  NET ${c}`);
  const links = await page.evaluate(() => [...document.querySelectorAll("a,[href],[data-href]")].map((a) => [(a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 30), a.href || a.getAttribute("href") || a.getAttribute("data-href")]).filter(([, h]) => h));
  const uniq = [...new Map(links.map(([t, h]) => [h, t])).entries()].slice(0, 60);
  for (const [h, t] of uniq) console.log(`  LINK [${t}] ${h}`);
  await page.close();
}

await probe("https://www.woodongs.com/", "메인");
for (const p of ["/event", "/events", "/promotion", "/benefit", "/product", "/products", "/gs25", "/gs25/event", "/deal", "/plus"]) {
  await probe(`https://www.woodongs.com${p}`, p);
}
await browser.close();
