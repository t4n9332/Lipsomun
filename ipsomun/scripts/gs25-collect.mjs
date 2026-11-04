#!/usr/bin/env node
/**
 * GS25 당월 행사상품(1+1·2+1·덤증정) 수집 → data/gs25/<YYYY-MM>/
 *
 * GS25 는 2026 개편 뒤 공식 웹에 행사 목록이 없다. 그래서 "어디서 받을지"는 실제 응답을 보고 정한다.
 * 이 스크립트는 받는 곳(소스)과 응답 구조(매핑 파일)를 분리해 두고, 받은 뒤의 일은 전부 자동으로 한다.
 *
 * ── 소스 3가지 ─────────────────────────────────────────────
 *  har  : 브라우저/앱 화면에서 정상 조회하며 저장한 HAR(.har) — 인증값은 읽는 즉시 버린다
 *  http : 매핑 파일의 request 에 적힌 목록 주소를 페이지 단위로 직접 조회(요청 간격·재시도·이어받기)
 *  csv  : 운영자가 직접 정리한 표(cvs-import.mjs 형식 + 확장 열)
 *
 * ── 순서 ───────────────────────────────────────────────────
 *  1) node scripts/gs25-collect.mjs --source=har --in=gs25.har --discover
 *       → 응답 안의 배열 경로·필드 이름·페이지 정보만(값은 가림) 출력. 큰 배열이 곧 '전체 행사 API'라는 뜻은 아니다.
 *  2) 보고서를 보고 scripts/gs25/mapping.json 작성(예시: scripts/gs25/mapping.example.json)
 *  3) node scripts/gs25-collect.mjs --source=har --in=gs25.har --map=scripts/gs25/mapping.json
 *     또는 node scripts/gs25-collect.mjs --source=http --map=scripts/gs25/mapping.json [--headers-file=~/gs25-headers.json]
 *
 * ── 옵션 ───────────────────────────────────────────────────
 *  --month=YYYY-MM   대상 월(기본: 한국시간 이번 달)
 *  --out=DIR         출력 폴더(기본 data/gs25/<월>, --sample 이면 scripts/out/gs25-sample/<월>)
 *  --prev=FILE       비교할 이전 결과(기본: 지난달 data/gs25/<지난달>/promotions.json)
 *  --sample          샘플·합성 입력임을 명시 → 결과는 '실제 수집 아님'으로 기록, data/ 에 쓰지 않음
 *  --resume          http: 이전 실행에서 받은 페이지는 건너뛰고 실패한 페이지만 다시
 *  --sanitize=FILE   har: 인증값을 지운 HAR 사본 저장(공유·이슈 첨부용)
 *  --headers-file=F  http: 요청 헤더 JSON 파일(저장소 밖에 둘 것). 환경변수 GS25_HEADERS_FILE 도 됨. 값은 로그에 안 찍힌다
 *  --bridge          결과의 1+1·2+1·3+1·덤 을 data/cvs/current.json 의 gs25 로 반영(/cvs 화면용, 같은 달일 때만)
 *
 * ── 결과 ───────────────────────────────────────────────────
 *  promotions.json · promotions.csv · diff.json(추가·변경·종료) · run.json(출처·수집 시각·범위·완료 상태) · failures.json
 *  종료코드: 0 완료(전체 검증 또는 관측 범위) · 2 일부 누락 · 3 실제 수집 미완료 · 1 사용법/입력 오류
 *
 * 이 스크립트는 로그인·차단을 우회하지 않는다. 401/403/429·차단 페이지를 만나면 멈추고 실패로 기록한다.
 * 자동 수집·외부 재사용이 허용되는지는 소스별로 run.json 의 terms 에 운영자가 확인한 내용을 적는다(매핑 파일 terms).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "./gs25/lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const flag = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : undefined; };
const has = (k) => args.includes(`--${k}`);
const die = (msg) => { console.error(msg); process.exit(1); };
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n"); };

const month = flag("month") || L.kstMonth();
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) die(`--month 형식 오류: ${month} (YYYY-MM)`);
const source = flag("source");
if (!["har", "http", "csv"].includes(source)) die("--source=har|http|csv 필요. 사용법은 파일 맨 위 주석.");
const SAMPLE = has("sample");
const input = flag("in");
const mapFile = flag("map");
const collected_at = L.kstStamp();
const prevMonth = (() => { const [y, m] = month.split("-").map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); })();
const outDir = path.resolve(flag("out") || (SAMPLE ? path.join(__dirname, "out", "gs25-sample", month) : path.join(ROOT, "data", "gs25", month)));
const ctxBase = { month, collected_at };

/* ---------------- 소스별 수집 ---------------- */

const failures = [];
let rawRows = [], declaredTotal = null, sourceUrls = new Set(), live = false, manual = false;
let mapping = null;
if (mapFile) {
  mapping = readJson(mapFile);
  const errs = L.checkMapping(mapping);
  if (errs.length) die(`매핑 파일 오류:\n · ${errs.join("\n · ")}`);
}

if (source === "har") {
  if (!input || !fs.existsSync(input)) die("--in=파일.har 필요");
  const har = L.sanitizeHar(readJson(input)); // 읽자마자 인증값 제거 — 이후로는 정제본만 다룬다
  if (flag("sanitize")) { writeJson(path.resolve(flag("sanitize")), har); console.log(`정제 HAR 저장: ${flag("sanitize")}`); }
  if (has("discover")) {
    const rep = L.discover(har);
    console.log(JSON.stringify({ note: "구조만 표시(값 가림). 큰 배열이 곧 전체 행사 목록이라는 뜻은 아님 — 화면의 건수·유형 탭과 대조할 것", entries: rep }, null, 2));
    process.exit(0);
  }
  if (!mapping) die("--map=매핑.json 필요(먼저 --discover 로 구조 확인)");
  const hits = har.log.entries.filter((e) => L.matchEntry(e, mapping));
  if (!hits.length) failures.push({ stage: "match", reason: `HAR 안에 '${mapping.match.urlIncludes}' 요청 없음` });
  const totals = new Map();
  for (const e of hits) {
    const why = L.blockReason(e.response.status, e.response.content?.mimeType, e.response.content?.text);
    if (why) { failures.push({ stage: "response", url: e.request.url, reason: why }); continue; }
    const j = L.entryJson(e);
    const r = j ? L.extractFromJson(j, mapping) : { ok: false };
    if (!r.ok) { failures.push({ stage: "parse", url: e.request.url, reason: `itemsPath '${mapping.itemsPath}' 가 배열이 아님` }); continue; }
    rawRows.push(...r.rows.map((x) => ({ ...x, _url: e.request.url })));
    if (r.total !== null) totals.set(totalScope(e.request.url, mapping), r.total);
    sourceUrls.add(e.request.url.split("?")[0]);
  }
  if (totals.size) declaredTotal = [...totals.values()].reduce((a, b) => a + b, 0);
  live = !SAMPLE;
} else if (source === "http") {
  if (!mapping?.request?.url) die("--source=http 는 매핑 파일에 request.url 이 필요(실제로 확인한 주소만)");
  const res = await fetchPaged(mapping);
  rawRows = res.rows; declaredTotal = res.total; sourceUrls = new Set([mapping.request.url.split("?")[0]]);
  live = !SAMPLE;
} else {
  if (!input || !fs.existsSync(input)) die("--in=파일.csv 필요");
  const { rows, unknownHeaders } = L.parseCsv(fs.readFileSync(input, "utf8"));
  if (unknownHeaders.length) console.warn(`무시한 열: ${unknownHeaders.join(", ")}`);
  rawRows = rows;
  sourceUrls.add(`file:${path.basename(input)}`);
  manual = !SAMPLE;
}

/** 유형별 탭처럼 같은 주소가 조건만 바꿔 여러 번 불릴 때, 조건별 전체 건수를 따로 더하기 위한 키 */
function totalScope(u, m) {
  try {
    const url = new URL(u);
    for (const p of m.pageParams || ["page", "pageNo", "pageNum", "pageIndex", "offset", "cursor"]) url.searchParams.delete(p);
    return url.toString();
  } catch { return u; }
}

/* ---------------- HTTP 페이지 조회(요청 간격·제한 재시도·이어받기) ---------------- */

async function fetchPaged(m) {
  const rq = m.request;
  const statePath = path.join(outDir, ".state.json");
  const state = has("resume") && fs.existsSync(statePath) ? readJson(statePath) : { pages: {} };
  const headersFile = flag("headers-file") || process.env.GS25_HEADERS_FILE;
  const extra = headersFile ? readJson(headersFile) : {}; // 값은 어디에도 기록하지 않는다
  const delay = Math.max(500, rq.delayMs || 1000);
  const size = rq.pageSize || 50;
  const start = rq.pageStart ?? 1;
  const maxPages = Math.min(rq.maxPages || 200, 500);
  const scopes = rq.scopes?.length ? rq.scopes : [{}]; // 유형 탭별 조회가 필요하면 [{promo:"1+1 코드"}, ...]
  const rows = [];
  let total = 0, totalKnown = true;
  for (const sc of scopes) {
    let scopeTotal = null;
    for (let i = 0; i < maxPages; i++) {
      const page = start + i;
      const key = `${JSON.stringify(sc)}#${page}`;
      let got = state.pages[key];
      if (!got) {
        const vars = { page, size, offset: i * size, month: month.replace("-", ""), ...sc };
        const fill = (s) => String(s).replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k] ?? ""));
        const url = fill(rq.url);
        const r = await getWithRetry(url, { method: rq.method || "GET", headers: { ...(rq.headers || {}), ...extra }, body: rq.body ? fill(rq.body) : undefined });
        if (r.error) { failures.push({ stage: "fetch", scope: sc, page, url: L.maskUrl(url), reason: r.error }); break; } // 실패한 페이지 뒤는 모른다 → 이 범위는 멈추고 --resume 으로 다시
        const ex = L.extractFromJson(r.json, m);
        if (!ex.ok) { failures.push({ stage: "parse", scope: sc, page, url: L.maskUrl(url), reason: `itemsPath '${m.itemsPath}' 가 배열이 아님` }); break; }
        got = { rows: ex.rows, total: ex.total, next: m.nextPath ? L.getPath(r.json, m.nextPath) ?? null : undefined };
        state.pages[key] = got;
        writeJson(statePath, state); // 페이지마다 저장 → 끊겨도 --resume 으로 이어받기
        await new Promise((ok) => setTimeout(ok, delay));
      }
      rows.push(...got.rows);
      if (got.total !== null) scopeTotal = got.total;
      if (!got.rows.length || got.rows.length < size || got.next === false || got.next === null) break;
      if (scopeTotal !== null && (i + 1) * size >= scopeTotal) break;
    }
    if (scopeTotal === null) totalKnown = false; else total += scopeTotal;
  }
  return { rows, total: totalKnown ? total : null };
}

async function getWithRetry(url, init) {
  let last = "";
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(url, { ...init, headers: { "User-Agent": "Mozilla/5.0 (compatible; gs25-collect/1.0; monthly)", Accept: "application/json", ...init.headers }, signal: AbortSignal.timeout(30_000) });
      const text = await res.text();
      const why = L.blockReason(res.status, res.headers.get("content-type"), text);
      if (why) {
        last = why;
        if (res.status === 401 || res.status === 403 || /차단|HTML/.test(why)) return { error: why, fatal: true }; // 인증·차단은 우회하지 않고 멈춤
        if (res.status === 429 || res.status >= 500) { await new Promise((ok) => setTimeout(ok, 2000 * 2 ** a)); continue; }
        return { error: why };
      }
      try { return { json: JSON.parse(text) }; } catch { return { error: "JSON 아님" }; }
    } catch (e) {
      last = e.cause?.code || e.name || "network";
      if (e instanceof TypeError && !e.cause) return { error: `요청 구성 오류: ${e.message}`, fatal: true }; // 재시도해도 같은 오류
      await new Promise((ok) => setTimeout(ok, 2000 * 2 ** a));
    }
  }
  return { error: `재시도 3회 실패: ${last}` };
}

/* ---------------- 정규화·중복·비교·검증·저장 ---------------- */

const ctx = { ...ctxBase, source: SAMPLE ? `${source}(sample)` : source, promoMap: mapping?.promoMap || null };
const recs = rawRows.map(({ _url, ...r }) => L.makeRecord(r, { ...ctx, source_url: _url ? _url.split("?")[0] : [...sourceUrls][0] || null }));
const { items, duplicates, rejected, products_with_multiple_promos } = L.dedupe(recs);
items.sort((a, b) => (a.promo_type_norm || "z").localeCompare(b.promo_type_norm || "z") || a.name.localeCompare(b.name, "ko"));

const prevFile = flag("prev") || path.join(ROOT, "data", "gs25", prevMonth, "promotions.json");
const prev = fs.existsSync(prevFile) ? readJson(prevFile).items || [] : null;
const diff = prev ? L.diffRecords(prev, items) : null;

const verdict = L.assess(items, { live, manual, sample: SAMPLE, failures: failures.length, declaredTotal, rawCount: rawRows.length, month });
const run = {
  target_month: month,
  collected_at,
  source,
  sample: SAMPLE,
  source_urls: [...sourceUrls],
  scope: mapping?.scopeNote || (source === "csv" ? "운영자 입력 표" : "매핑 파일에 범위 설명 없음"),
  terms: mapping?.terms || "미확인 — 기술적으로 조회되는 것과 자동 수집·외부 재사용 허용은 별개. 매핑 파일 terms 에 확인 결과를 적을 것",
  raw_rows: rawRows.length,
  declared_total: declaredTotal,
  duplicates_merged: duplicates,
  rejected: rejected.length,
  products_with_multiple_promos,
  failures: failures.length,
  previous: prev ? path.relative(ROOT, prevFile) : null,
  diff: diff ? { added: diff.added.length, changed: diff.changed.length, ended: diff.ended.length, type_changed: diff.type_changed.length } : null,
  ...verdict,
};

writeJson(path.join(outDir, "promotions.json"), { target_month: month, collected_at, source: ctx.source, status: verdict.status, items });
fs.writeFileSync(path.join(outDir, "promotions.csv"), L.toCsv(items));
writeJson(path.join(outDir, "run.json"), run);
writeJson(path.join(outDir, "failures.json"), { failures, rejected: rejected.map((x) => ({ reason: x.reason, name: x.record.name, raw: x.record.promo_type_raw })) });
if (diff) writeJson(path.join(outDir, "diff.json"), diff);

console.log(`GS25 ${month} · ${ctx.source} · ${items.length}건 (원천 ${rawRows.length}, 중복 ${duplicates}, 제외 ${rejected.length}, 실패 ${failures.length})`);
console.log(`유형: ${Object.entries(verdict.by_type).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`상태: ${verdict.status} — ${verdict.reasons.join(" / ")}`);
if (diff) console.log(`지난 결과 대비: 추가 ${diff.added.length} · 변경 ${diff.changed.length} · 종료 ${diff.ended.length}`);
console.log(`저장: ${path.relative(process.cwd(), outDir) || outDir}`);

/* ---------------- /cvs 화면 연동(선택) ---------------- */

if (has("bridge")) {
  const cvsFile = path.join(ROOT, "data", "cvs", "current.json");
  const cur = readJson(cvsFile);
  if (SAMPLE || verdict.status === L.STATUS.BLOCKED) console.log("bridge 건너뜀: 실제 수집 결과가 아님");
  else if (cur.month !== month) console.log(`bridge 건너뜀: current.json 은 ${cur.month}, 이번 결과는 ${month}`);
  else {
    const seen = new Set();
    const gs = items.filter((r) => r.promo_type_norm && r.price).map((r) => ({ b: "gs25", n: r.name, p: r.price, t: r.promo_type_norm, ...(r.image_url ? { img: r.image_url } : {}) }))
      .filter((x) => { const k = `${L.normName(x.n)}|${x.t}|${x.p}`; if (seen.has(k)) return false; seen.add(k); return true; });
    cur.items = [...gs, ...cur.items.filter((x) => x.b !== "gs25")];
    if (cur.stale) cur.stale = cur.stale.filter((b) => b !== "gs25");
    writeJson(cvsFile, cur);
    console.log(`bridge: data/cvs/current.json 의 GS25 ${gs.length}건 반영`);
  }
}

process.exit(verdict.status === L.STATUS.BLOCKED ? 3 : verdict.status === L.STATUS.PARTIAL ? 2 : 0);
