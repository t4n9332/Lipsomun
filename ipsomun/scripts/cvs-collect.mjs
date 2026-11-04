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
// 숨김 폴더(.으로 시작)는 Actions 아티팩트 업로드에서 빠지므로 일반 이름으로 둔다
const DEBUG_DIR = path.join(__dirname, "cvs-debug");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const ONLY = args.find((a) => a.startsWith("--only="))?.split("=")[1];
// --dry 에서는 응답 원문 일부를 로그에 찍는다 — 사이트 구조가 바뀌었을 때 로그만 보고 파서를 고칠 수 있게
const DIAG = DRY || args.includes("--diag");
const diag = (label, text) => {
  if (!DIAG) return;
  const t = String(text).replace(/\s+/g, " ");
  console.log(`  [진단] ${label} (${t.length}자): ${t.slice(0, 1500)}`);
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_PAGES = 200; // 무한 루프 방지
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 공통 유틸 ---------------- */

// 해외 IP 를 막는 사이트(세븐일레븐)는 사이트의 서울 리전 중계(/api/cvs/proxy)로 받는다.
// Actions 에서는 워크플로가 CVS_PROXY_URL·CRON_SECRET 을 넣어 준다.
const PROXY = process.env.CVS_PROXY_URL;
const PROXY_KEY = process.env.CRON_SECRET;
const viaProxyHosts = new Set();

async function viaProxy(url, init) {
  const res = await fetch(PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${PROXY_KEY}` },
    body: JSON.stringify({ url, method: init.method || "GET", headers: init.headers || {}, body: init.body }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`중계 HTTP ${res.status} (${res.headers.get("x-proxy-region") || "?"}): ${(await res.text()).slice(0, 200)}`);
  return res;
}

async function get(url, init = {}) {
  const host = new URL(url).hostname;
  if (viaProxyHosts.has(host)) return viaProxy(url, init);
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
      // 연결 자체가 안 되면(HTTP 응답 없음) 해외 IP 차단으로 보고 서울 중계로 전환 — 이후 같은 호스트는 계속 중계
      const network = !String(e.message).startsWith("HTTP");
      if (network && PROXY && PROXY_KEY) {
        console.log(`  ↪ ${host} 직접 연결 실패(${e.cause?.code || e.message}) — 서울 중계로 전환`);
        viaProxyHosts.add(host);
        return viaProxy(url, init);
      }
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
  diag(`${name} 원문`, body);
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
        // 배지 div 안에 "[D] .plus2 : 2+1 / .plus1 : 1+1" 주석이 있어 div 전체를 읽으면 늘 2+1 로 잡힌다 — span 만 본다
        t: dealType(pick(b, /<span class="plus\d"[^>]*>([\s\S]*?)<\/span>/) || (cond === "23" ? "1+1" : "2+1")),
        img: absUrl(b.match(/<img[^>]+src="([^"]+)"/)?.[1], "https://cu.bgfretail.com/"),
      }));
      if (page === 1) {
        if (items.length === 0) debugDump(`cu-${cond}`, html);
        else diag(`cu-${cond} 1쪽 ${items.length}개, 첫 블록`, blocks(html, /<li class="prod_list/g)[0]);
      }
      if (items.length === 0) break;
      out.push(...items);
      await sleep(300);
    }
  }
  return out;
}

/* ---------------- GS25 ---------------- */
// 2026-11 확인: GS25 홈페이지가 Vue 앱으로 개편되면서 웹 행사상품 목록과 예전 검색 API
// (/gscvs/ko/products/event-goods-search)가 사라졌다 — 어떤 주소로 요청해도 새 홈페이지 껍데기만 온다.
// 번들·지연 청크 125개 어디에도 행사상품 API 가 없어, 행사 목록은 앱(우리동네GS)으로 옮겨간 것으로 본다.
// 앱 API 를 뜯어 쓰는 것은 약관상 위험해 하지 않는다. 그래서 기본 수집에서 뺀다(SKIP).
// GS25 가 웹 목록을 다시 열면 이 함수를 새 구조에 맞게 쓰고 SKIP 에서 지우면 된다.
// 그동안은 scripts/cvs-import.mjs 로 CSV 를 직접 넣을 수 있다.
async function fetchGS25() {
  throw new Error("GS25 공식 웹 행사 목록 미제공 (2026 개편) — cvs-import.mjs 로 수동 등록");
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
      // 상품 하나 = <li><ul class="tag_list_01">(행사 배지)</ul> … 이름·가격 … </li>.
      // 속성을 작은따옴표(class='name')로 쓰므로 따옴표 종류를 가리지 않는다.
      // 증정(덤) 탭은 블록 안에 '증정 상품'이 하나 더 있어, 첫 번째 이름·가격(본상품)만 쓴다.
      const items = blocks(html, /<ul class=["']tag_list_01["']/g)
        .map((b) => ({
          b: "seven",
          n: pick(b, /class=["']name["'][^>]*>([\s\S]*?)<\/div>/),
          p: toPrice(pick(b, /class=["']price["'][^>]*>\s*<span>([\s\S]*?)<\/span>/)),
          t: dealType(pick(b, /class=["']ico_tag_\d+["'][^>]*>([\s\S]*?)<\/li>/) || fallback),
          img: absUrl(b.match(/<img[^>]+src=["']([^"']+)["']/)?.[1], "https://www.7-eleven.co.kr/"),
        }))
        .filter((x) => x.n);
      if (page === 1 && items.length === 0) debugDump(`seven-${tab}`, html);
      // 진단: 쪽마다 몇 개 읽었는지 (증정 탭이 일찍 끊기는지 확인용)
      if (DIAG && (page <= 3 || items.length < 10)) {
        diag(`seven-${tab} ${page}쪽 ${items.length}개 (원문 블록 ${blocks(html, /<ul class=["']tag_list_01["']/g).length})`, tab === "3" && page <= 2 ? html.slice(-1500) : "");
      }
      // 마지막 쪽을 넘기면 빈 응답이거나 같은 쪽을 다시 줄 수 있다
      if (items.length === 0 || items[0].n === out.at(-items.length)?.n) break;
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
/** 기본 수집에서 빼는 곳 — 실패로 치지 않고, 이전(또는 수동 등록) 데이터를 그대로 둔다 */
const SKIP = new Set(["gs25"]);

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
    if (SKIP.has(brand) && ONLY !== brand) {
      console.log(`- ${brand}: 건너뜀 (공식 웹 행사 목록 없음 — 수동 등록 데이터 유지)`);
      continue;
    }
    try {
      const items = clean(await fn());
      results[brand] = items;
      const byType = items.reduce((m, x) => ((m[x.t] = (m[x.t] || 0) + 1), m), {});
      console.log(`✓ ${brand}: ${items.length}개`, byType);
      if (DRY && items[0]) console.log("   예:", items.slice(0, 3));
      if (items.length === 0) failed.push(brand);
    } catch (e) {
      // fetch failed 같은 네트워크 오류는 진짜 원인이 e.cause 에 있다 (TLS·DNS·연결 거부 등)
      const cause = e.cause ? ` — 원인: ${e.cause.code || ""} ${e.cause.message || e.cause}` : "";
      console.error(`✗ ${brand}: ${e.message}${cause}`);
      failed.push(brand);
    }
  }
  if (DRY) return failed.length ? process.exit(1) : undefined;

  // 실패한 편의점은 이전 데이터를 유지한다 (빈 목록으로 덮어쓰지 않게)
  const keep = (brand) =>
    // 건너뛴 곳(GS25)은 이번 달에 손으로 넣은 데이터만 유지 — 지난달 것을 이번 달로 둔갑시키지 않는다
    SKIP.has(brand) && current.month !== month ? [] : (current.items || []).filter((x) => x.b === brand);
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
    // 한국 시각, 예: 2026-11-04T06:22+09:00 (farm.json 과 같은 형식)
    generated_at: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16) + "+09:00",
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
