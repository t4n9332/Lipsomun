#!/usr/bin/env node
/**
 * 편의점 4사 행사상품(1+1·2+1·3+1·덤) 수집 → data/cvs/current.json
 *
 *   node scripts/cvs-collect.mjs           # 수집 + 저장 (달이 바뀌었으면 current → previous 로 밀어냄)
 *   node scripts/cvs-collect.mjs --dry     # 저장 없이 편의점별 개수·샘플만 출력
 *   node scripts/cvs-collect.mjs --only=cu # 한 곳만 (디버깅용)
 *
 * GitHub Actions(.github/workflows/cvs-monthly.yml)가 매월 1일 09:10 KST 에 돌리고 커밋한다.
 * 커밋되면 Vercel 이 다시 빌드해 /cvs 페이지가 갱신된다 (산지직송 farm.json 과 같은 방식).
 *
 * 안전장치
 *  - 편의점마다 따로 돈다. 한 곳이 실패해도 나머지는 저장된다.
 *  - 실패(0개)한 편의점은 이전 데이터를 그대로 유지하고 stale 로 표시 → 종료코드 1 (Actions 실패 메일).
 *  - 0개일 때 받은 원문을 scripts/.cvs-debug/ 에 남긴다 — 사이트 개편으로 파서가 깨졌을 때 고칠 단서.
 *
 * 각 사이트의 내부 목록 API/HTML 구조는 예고 없이 바뀐다. 깨지면 해당 fetchXxx 함수만 고치면 된다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "cvs");
const DEBUG_DIR = path.join(__dirname, ".cvs-debug");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const ONLY = args.find((a) => a.startsWith("--only="))?.split("=")[1];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_PAGES = 200; // 무한 루프 방지
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 공통 유틸 ---------------- */

async function get(url, init = {}) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9", ...(init.headers || {}) },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (i === 2) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}
const form = (o) => new URLSearchParams(o).toString();
const FORM_HEADERS = { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" };

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const toPrice = (s) => Number(String(s ?? "").replace(/[^0-9]/g, "")) || 0;
const absUrl = (src, base) => {
  if (!src) return undefined;
  if (src.startsWith("//")) return "https:" + src;
  try { return new URL(src, base).href; } catch { return undefined; }
};
/** "1+1", "2+1", "3+1" 외(증정·덤)는 '덤' */
function dealType(s) {
  const m = String(s).replace(/\s/g, "").match(/([123])\+1/);
  return m ? `${m[1]}+1` : "덤";
}
function debugDump(name, body) {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    fs.writeFileSync(path.join(DEBUG_DIR, `${name}.txt`), String(body).slice(0, 200_000));
  } catch {}
}
/** 블록 단위로 잘라 각 블록에서 필드를 뽑는다 (HTML 파서 의존성 없이) */
function blocks(html, startRe) {
  const idx = [];
  for (const m of html.matchAll(startRe)) idx.push(m.index);
  return idx.map((s, i) => html.slice(s, idx[i + 1] ?? s + 4000));
}
const pick = (blk, re) => {
  const m = blk.match(re);
  return m ? decode(m[1]) : "";
};

/* ---------------- CU ---------------- */
// 행사 목록은 POST /event/plusAjax.do 가 HTML 조각(li.prod_list)을 페이지 단위로 돌려준다.
// searchCondition 23 = 1+1, 24 = 2+1 (3+1 은 비정기라 23/24 에서 같이 나오면 배지로 판별).
async function fetchCU() {
  const out = [];
  for (const cond of ["23", "24"]) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await (
        await get("https://cu.bgfretail.com/event/plusAjax.do", {
          method: "POST",
          headers: { ...FORM_HEADERS, Referer: "https://cu.bgfretail.com/event/plus.do" },
          body: form({ pageIndex: page, listType: 0, searchCondition: cond, user_id: "" }),
        })
      ).text();
      const items = blocks(html, /<li class="prod_list/g).map((b) => ({
        b: "cu",
        n: pick(b, /class="name"[^>]*>\s*<p>([\s\S]*?)<\/p>/),
        p: toPrice(pick(b, /class="price"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>/)),
        t: dealType(pick(b, /class="badge"[^>]*>([\s\S]*?)<\/div>/) || (cond === "23" ? "1+1" : "2+1")),
        img: absUrl(b.match(/<img[^>]+src="([^"]+)"/)?.[1], "https://cu.bgfretail.com/"),
      }));
      if (page === 1 && items.length === 0) debugDump(`cu-${cond}`, html);
      if (items.length === 0) break;
      out.push(...items);
      await sleep(300);
    }
  }
  return out;
}

/* ---------------- GS25 ---------------- */
// 행사 페이지에서 CSRFToken·세션 쿠키를 받은 뒤 /event-goods-search 를 부르면 JSON(문자열로 한 번 더
// 감싼 JSON)이 온다. parameterList: ONE_TO_ONE(1+1) / TWO_TO_ONE(2+1) / GIFT(덤증정).
async function fetchGS25() {
  const pageRes = await get("https://gs25.gsretail.com/gscvs/ko/products/event-goods");
  const pageHtml = await pageRes.text();
  const token = pageHtml.match(/name="CSRFToken"\s+value="([^"]+)"/)?.[1] || pageHtml.match(/CSRFToken\s*=\s*'([^']+)'/)?.[1];
  const cookie = (pageRes.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  if (!token) {
    debugDump("gs25-page", pageHtml);
    throw new Error("CSRFToken 을 찾지 못함");
  }
  const out = [];
  for (const param of ["ONE_TO_ONE", "TWO_TO_ONE", "GIFT"]) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const raw = await (
        await get(`https://gs25.gsretail.com/gscvs/ko/products/event-goods-search?CSRFToken=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { ...FORM_HEADERS, Cookie: cookie, Referer: "https://gs25.gsretail.com/gscvs/ko/products/event-goods" },
          body: form({ pageNum: page, pageSize: 50, searchType: "", searchWord: "", parameterList: param }),
        })
      ).text();
      let data;
      try {
        data = JSON.parse(raw);
        if (typeof data === "string") data = JSON.parse(data);
      } catch {
        debugDump(`gs25-${param}`, raw);
        throw new Error(`${param} 응답이 JSON 이 아님`);
      }
      const rows = data?.results || [];
      for (const r of rows) {
        out.push({
          b: "gs25",
          n: decode(r.goodsNm || ""),
          p: toPrice(r.price),
          t: dealType(r.eventTypeNm || r.eventTypeSp?.code || (param === "ONE_TO_ONE" ? "1+1" : param === "TWO_TO_ONE" ? "2+1" : "덤")),
          img: absUrl(r.attFileNm || r.attFileNmOld, "https://gs25.gsretail.com/"),
        });
      }
      const last = data?.pagination?.numberOfPages ?? (rows.length ? page + 1 : page);
      if (!rows.length || page >= last) break;
      await sleep(300);
    }
  }
  return out;
}

/* ---------------- 세븐일레븐 ---------------- */
// POST /product/listMoreAjax.asp 가 HTML 조각을 준다. pTab 1 = 1+1, 2 = 2+1, 3 = 증정.
async function fetchSeven() {
  const out = [];
  const tabs = { 1: "1+1", 2: "2+1", 3: "덤" };
  for (const [tab, fallback] of Object.entries(tabs)) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await (
        await get("https://www.7-eleven.co.kr/product/listMoreAjax.asp", {
          method: "POST",
          headers: { ...FORM_HEADERS, Referer: "https://www.7-eleven.co.kr/product/presentList.asp" },
          body: form({ intPageSize: 10, intCurrPage: page, cateCd1: "", cateCd2: "", cateCd3: "", pTab: tab }),
        })
      ).text();
      const items = blocks(html, /<div class="pic_product/g)
        .map((b) => ({
          b: "seven",
          n: pick(b, /class="name"[^>]*>([\s\S]*?)<\/div>/),
          p: toPrice(pick(b, /class="price"[^>]*>([\s\S]*?)<\/div>/)),
          t: dealType(pick(b, /class="tag_list_01"[^>]*>([\s\S]*?)<\/ul>/) || fallback),
          img: absUrl(b.match(/<img[^>]+src="([^"]+)"/)?.[1], "https://www.7-eleven.co.kr/"),
        }))
        .filter((x) => x.n);
      if (page === 1 && items.length === 0) debugDump(`seven-${tab}`, html);
      if (items.length === 0) break;
      out.push(...items);
      await sleep(300);
    }
  }
  return out;
}

/* ---------------- 이마트24 ---------------- */
// GET /goods/event?category_seq=N&page=P 의 HTML. 1 = 1+1, 2 = 2+1, 3 = 3+1, 4 = 덤.
async function fetchEmart24() {
  const out = [];
  const cats = { 1: "1+1", 2: "2+1", 3: "3+1", 4: "덤" };
  for (const [seq, fallback] of Object.entries(cats)) {
    let prevFirst = "";
    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await (await get(`https://emart24.co.kr/goods/event?search=&page=${page}&category_seq=${seq}&align=`)).text();
      const items = blocks(html, /<div class="itemWrap/g)
        .map((b) => ({
          b: "emart24",
          n: pick(b, /class="itemtitle"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/) || pick(b, /class="itemtitle"[^>]*>([\s\S]*?)<\/div>/),
          p: toPrice(pick(b, /class="price"[^>]*>([\s\S]*?)<\/span>/) || pick(b, /class="price"[^>]*>([\s\S]*?)<\/div>/)),
          t: dealType(pick(b, /class="itemTit"[^>]*>([\s\S]*?)<\/div>/) || fallback),
          img: absUrl(b.match(/<img[^>]+src="([^"]+)"/)?.[1], "https://emart24.co.kr/"),
        }))
        .filter((x) => x.n);
      if (page === 1 && items.length === 0) debugDump(`emart24-${seq}`, html);
      // 마지막 페이지를 넘기면 같은 페이지를 반복해서 주는 경우가 있다
      if (items.length === 0 || items[0].n === prevFirst) break;
      prevFirst = items[0].n;
      out.push(...items);
      await sleep(300);
    }
  }
  return out;
}

/* ---------------- 실행 ---------------- */

const FETCHERS = { gs25: fetchGS25, cu: fetchCU, seven: fetchSeven, emart24: fetchEmart24 };

function clean(items) {
  const seen = new Set();
  return items.filter((it) => {
    if (!it.n || it.p <= 0) return false;
    const k = `${it.b}|${it.n}|${it.t}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function kstMonth() {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().slice(0, 7);
}

const readJson = (f) => {
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
};

async function main() {
  const month = kstMonth();
  const currentPath = path.join(DATA_DIR, "current.json");
  const previousPath = path.join(DATA_DIR, "previous.json");
  const current = readJson(currentPath) || { month: "", items: [] };

  const results = {};
  const failed = [];
  for (const [brand, fn] of Object.entries(FETCHERS)) {
    if (ONLY && ONLY !== brand) continue;
    try {
      const items = clean(await fn());
      results[brand] = items;
      const byType = items.reduce((m, x) => ((m[x.t] = (m[x.t] || 0) + 1), m), {});
      console.log(`✓ ${brand}: ${items.length}개`, byType);
      if (DRY && items[0]) console.log("   예:", items.slice(0, 3));
      if (items.length === 0) failed.push(brand);
    } catch (e) {
      console.error(`✗ ${brand}: ${e.message}`);
      failed.push(brand);
    }
  }
  if (DRY) return failed.length ? process.exit(1) : undefined;

  // 실패한 편의점은 이전 데이터를 유지한다 (빈 목록으로 덮어쓰지 않게)
  const keep = (brand) => (current.items || []).filter((x) => x.b === brand);
  const items = Object.keys(FETCHERS).flatMap((b) => (results[b]?.length ? results[b] : keep(b)));
  if (items.length === 0) {
    console.error("모든 편의점 수집 실패 — 아무것도 저장하지 않습니다.");
    process.exit(1);
  }

  fs.mkdirSync(path.join(DATA_DIR, "archive"), { recursive: true });
  // 달이 바뀌었으면 지난달 데이터를 previous 로 민다 (버프/너프 비교 기준)
  if (current.month && current.month !== month && current.items?.length) {
    fs.writeFileSync(previousPath, JSON.stringify(current));
    fs.writeFileSync(path.join(DATA_DIR, "archive", `${current.month}.json`), JSON.stringify(current));
  }
  const next = {
    month,
    generated_at: new Date(Date.now() + 9 * 3600_000).toISOString().replace("Z", "+09:00").slice(0, 22) + ":00",
    items,
    ...(failed.length ? { stale: failed } : {}),
  };
  fs.writeFileSync(currentPath, JSON.stringify(next));
  console.log(`저장: ${month} — ${items.length}개${failed.length ? ` (이전 데이터 유지: ${failed.join(", ")})` : ""}`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
