// 임시 진단: GS25 공식 웹에서 행사상품 데이터가 어디서 오는지, 실제 브라우저로 열어 네트워크 요청을 기록한다.
import { chromium } from "playwright";

const START = [
  "https://gs25.gsretail.com/gscvs/ko/products/event-goods",
  "https://gs25.gsretail.com/",
  "https://www.gsretail.com/brand/gs25",
  "https://www.woodongs.com/",
];
const KW = /행사|이벤트|1\+1|2\+1|event|promotion|덤|증정|상품/i;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  locale: "ko-KR",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
});
const seen = new Set();

async function probe(url, depth) {
  if (seen.has(url) || seen.size > 14) return;
  seen.add(url);
  const page = await ctx.newPage();
  const calls = [];
  page.on("response", async (r) => {
    const t = r.request().resourceType();
    if (t !== "xhr" && t !== "fetch") return;
    const ct = r.headers()["content-type"] || "";
    let sample = "";
    try { if (ct.includes("json") || ct.includes("text")) sample = (await r.text()).slice(0, 300).replace(/\s+/g, " "); } catch {}
    calls.push(`${r.request().method()} ${r.status()} ${r.url().slice(0, 220)} [${ct.split(";")[0]}] ${sample}`);
  });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 40000 });
  } catch (e) { console.log(`!! ${url} 열기 실패: ${e.message.slice(0, 120)}`); }
  await page.waitForTimeout(3000);
  console.log(`\n==== ${url} → ${page.url()} | 제목: ${await page.title()}`);
  const text = (await page.evaluate(() => document.body?.innerText || "")).replace(/\s+/g, " ");
  console.log(`본문(앞 400자): ${text.slice(0, 400)}`);
  for (const c of calls.slice(0, 40)) console.log(`  XHR ${c}`);
  const links = await page.evaluate(() =>
    [...document.querySelectorAll("a")].map((a) => [(a.innerText || a.title || "").trim().slice(0, 40), a.href]).filter(([, h]) => h && h.startsWith("http"))
  );
  const hits = links.filter(([t, h]) => /행사|이벤트|1\+1|event|promotion|woodongs|우리동네/i.test(t + " " + h));
  for (const [t, h] of hits.slice(0, 25)) console.log(`  LINK [${t}] ${h}`);
  await page.close();
  if (depth > 0) for (const [, h] of hits.slice(0, 6)) await probe(h, depth - 1);
}

for (const u of START) await probe(u, 1);
await browser.close();
