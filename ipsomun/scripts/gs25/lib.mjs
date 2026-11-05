/**
 * GS25 당월 행사상품 수집 — 순수 로직(정규화·중복·비교·검증·HAR 분석·CSV).
 * 네트워크·파일 입출력은 gs25-collect.mjs 가 맡고, 여기는 테스트 가능한 함수만 둔다.
 *
 * 원칙
 *  - 응답 필드 이름을 추측하지 않는다. 실제 응답(HAR)을 --discover 로 본 뒤 사람이 매핑 파일에 적는다.
 *  - 행사 유형은 원문(promo_type_raw)을 그대로 보존하고, 정확히 1+1·2+1·3+1·덤일 때만 정규화한다.
 *    2+2·묶음할인·페이백·쿠폰·% 할인은 promo_type_norm=null, promo_class="other" 로 남긴다.
 *  - 모르는 값은 null. 0·빈 문자열로 채우지 않는다.
 */

export const NORM_TYPES = ["1+1", "2+1", "3+1", "덤"];
export const REQUIRED_TYPES = ["1+1", "2+1", "덤"]; // 완료 판정에 필요한 유형(과제 기준)

export const STATUS = {
  FULL: "전체 범위 검증 후 수집 완료",
  OBSERVED: "관측 가능한 범위 수집 완료, 전체성은 미검증",
  PARTIAL: "일부 유형 또는 조건 누락",
  BLOCKED: "접근환경 부족으로 실제 수집 미완료",
};

/* ---------------- 값 다듬기 ---------------- */

export const clean = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};
export const toPrice = (v) => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  const d = String(v).replace(/[^\d.]/g, "");
  const n = Number(d);
  return d && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
/** 20261101 · 2026-11-01 · 2026.11.01 · 2026/11/01 · ISO → "2026-11-01". 못 읽으면 null */
export const toDate = (v) => {
  const s = clean(v);
  if (!s) return null;
  const m = s.match(/(20\d{2})[-./년\s]?\s*(\d{1,2})[-./월\s]?\s*(\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
/** 상품명 비교용 키 — 공백·괄호·구분자 제거, 소문자. 용량(355ml 등)은 남긴다 */
export const normName = (s) => String(s || "").toLowerCase().replace(/[\s()[\]{}<>)_\-·.,/]/g, "");

/**
 * 행사 유형 정규화. 원문이 정확히 아래 형태일 때만 인정한다.
 *   "1+1" "1 + 1" "1+1행사" → 1+1 / "2+1" → 2+1 / "3+1" → 3+1 / "덤" "덤증정" "증정" → 덤
 * explicit(매핑 파일의 promoMap)이 있으면 그것을 먼저 쓴다(응답이 코드값일 때 — 사람이 확인해서 적은 표).
 * 그 외(2+2, 1+2, 50%, 페이백, 쿠폰, 묶음, 할인)는 null.
 */
export function normPromo(raw, explicit = null) {
  const s = clean(raw);
  if (!s) return null;
  if (explicit && Object.prototype.hasOwnProperty.call(explicit, s)) {
    const v = explicit[s];
    return NORM_TYPES.includes(v) ? v : null;
  }
  const t = s.replace(/\s/g, "");
  if (/^(1\+1)(행사|상품)?$/.test(t)) return "1+1";
  if (/^(2\+1)(행사|상품)?$/.test(t)) return "2+1";
  if (/^(3\+1)(행사|상품)?$/.test(t)) return "3+1";
  if (/^(덤|덤증정|증정|덤행사|증정행사)$/.test(t)) return "덤";
  return null;
}

/* ---------------- 레코드 ---------------- */

export const FIELDS = [
  "target_month", "brand", "product_code", "barcode", "name", "price",
  "promo_type_raw", "promo_type_norm", "promo_class", "promo_condition",
  "gift_name", "gift_code", "gift_price", "start_date", "end_date",
  "category", "image_url", "source", "source_url", "collected_at", "dedupe_key",
];

/** 출처 무관 공통 레코드 만들기. 없는 값은 null */
export function makeRecord(src, ctx) {
  const promo_type_raw = clean(src.promo_type_raw);
  const promo_type_norm = normPromo(promo_type_raw, ctx.promoMap);
  const r = {
    target_month: ctx.month,
    brand: "GS25",
    product_code: clean(src.product_code),
    barcode: clean(src.barcode),
    name: clean(src.name),
    price: toPrice(src.price),
    promo_type_raw,
    promo_type_norm,
    promo_class: promo_type_norm ? "bogo" : promo_type_raw ? "other" : null,
    promo_condition: clean(src.promo_condition),
    gift_name: clean(src.gift_name),
    gift_code: clean(src.gift_code),
    gift_price: toPrice(src.gift_price),
    start_date: toDate(src.start_date),
    end_date: toDate(src.end_date),
    category: clean(src.category),
    image_url: clean(src.image_url),
    source: ctx.source,
    source_url: ctx.source_url ?? null,
    collected_at: ctx.collected_at,
  };
  r.dedupe_key = dedupeKey(r);
  return r;
}

/**
 * 중복 키 — 상품코드 하나로만 묶지 않는다.
 * 같은 상품이라도 행사 유형·기간·증정품이 다르면 다른 행사로 본다.
 */
export function dedupeKey(r) {
  return [
    r.product_code || "", r.barcode || "", normName(r.name),
    r.promo_type_raw || "", r.start_date || "", r.end_date || "",
    r.gift_code || normName(r.gift_name), r.price ?? "",
  ].join("|");
}

/** 같은 키는 하나로, 남는 레코드에 겹친 횟수를 기록. 필수값(이름·행사원문) 없는 것은 rejected 로 */
export function dedupe(records) {
  const map = new Map();
  const rejected = [];
  let dup = 0;
  for (const r of records) {
    if (!r.name || !r.promo_type_raw) { rejected.push({ reason: !r.name ? "상품명 없음" : "행사 유형 없음", record: r }); continue; }
    const k = r.dedupe_key;
    if (map.has(k)) { dup++; map.get(k)._seen++; continue; }
    map.set(k, { ...r, _seen: 1 });
  }
  const items = [...map.values()].map(({ _seen, ...r }) => r);
  // 같은 상품(코드 또는 이름)에 서로 다른 행사가 여럿이면 표시만 한다(합치지 않음)
  const byProd = new Map();
  for (const r of items) {
    const p = r.product_code || r.barcode || normName(r.name);
    byProd.set(p, (byProd.get(p) || 0) + 1);
  }
  const multi = [...byProd.values()].filter((n) => n > 1).length;
  return { items, duplicates: dup, rejected, products_with_multiple_promos: multi };
}

/* ---------------- 이전 결과 비교 ---------------- */

const identity = (r) => `${r.product_code || r.barcode || normName(r.name)}|${r.promo_type_norm || r.promo_type_raw}|${r.gift_code || normName(r.gift_name)}`;
const COMPARE = ["price", "promo_type_norm", "promo_condition", "start_date", "end_date", "gift_price", "name"];

/** 추가·변경·종료. 같은 상품의 행사 유형이 바뀌면 (이전 종료 + 신규 추가) 로 잡히고 type_changed 에도 남긴다 */
export function diffRecords(prev, cur) {
  const P = new Map(prev.map((r) => [identity(r), r]));
  const C = new Map(cur.map((r) => [identity(r), r]));
  const added = [], changed = [], ended = [];
  for (const [k, r] of C) {
    const o = P.get(k);
    if (!o) { added.push(r); continue; }
    const fields = COMPARE.filter((f) => (o[f] ?? null) !== (r[f] ?? null));
    if (fields.length) changed.push({ key: k, fields, before: pickF(o, fields), after: pickF(r, fields) });
  }
  for (const [k, r] of P) if (!C.has(k)) ended.push(r);
  const prodKey = (r) => r.product_code || r.barcode || normName(r.name);
  const endedBy = new Map(ended.map((r) => [prodKey(r), r]));
  const type_changed = added.filter((r) => endedBy.has(prodKey(r)))
    .map((r) => ({ product: r.name, before: endedBy.get(prodKey(r)).promo_type_raw, after: r.promo_type_raw }));
  return { added, changed, ended, type_changed };
}
const pickF = (o, fs) => Object.fromEntries(fs.map((f) => [f, o[f] ?? null]));

/* ---------------- 검증·완료 판정 ---------------- */

/**
 * @param items 중복 제거된 레코드
 * @param ev { live: 실제 조회였나, sample: 샘플/합성 입력인가, failures: 실패 수,
 *             declaredTotal: 서버가 응답한 전체 건수(근거가 있을 때만), scopeNote }
 */
export function assess(items, ev) {
  const byType = Object.fromEntries([...NORM_TYPES, "other"].map((t) => [t, 0]));
  for (const r of items) byType[r.promo_type_norm || "other"]++;
  const missingTypes = REQUIRED_TYPES.filter((t) => !byType[t]);
  const gaps = {
    price_null: items.filter((r) => r.price == null).length,
    period_null: items.filter((r) => !r.start_date || !r.end_date).length,
    gift_null_for_덤: items.filter((r) => r.promo_type_norm === "덤" && !r.gift_name && !r.gift_code).length,
    code_null: items.filter((r) => !r.product_code && !r.barcode).length,
    out_of_month: ev.month ? items.filter((r) => !overlapsMonth(r, ev.month)).length : 0,
  };
  const reasons = [];
  let status;
  if (!ev.live && !ev.manual) {
    status = STATUS.BLOCKED;
    reasons.push(ev.sample ? "샘플·합성 입력으로 실행 — 실제 전체 수집 아님" : "실제 조회 없음");
  } else if (!items.length) {
    status = STATUS.BLOCKED;
    reasons.push("수집 0건 (차단·빈 응답)");
  } else if (missingTypes.length || gaps.gift_null_for_덤) {
    status = STATUS.PARTIAL;
    if (missingTypes.length) reasons.push(`유형 누락: ${missingTypes.join(", ")}`);
    if (gaps.gift_null_for_덤) reasons.push(`덤 증정품 정보 없음 ${gaps.gift_null_for_덤}건`);
  } else if (ev.failures) {
    status = STATUS.PARTIAL;
    reasons.push(`요청 실패 ${ev.failures}건 — 재실행 필요`);
  } else if (Number.isInteger(ev.declaredTotal) && ev.declaredTotal === ev.rawCount) {
    status = STATUS.FULL;
    reasons.push(`서버가 밝힌 전체 건수 ${ev.declaredTotal} = 받은 건수 ${ev.rawCount}`);
  } else {
    status = STATUS.OBSERVED;
    reasons.push(Number.isInteger(ev.declaredTotal)
      ? `서버 전체 건수 ${ev.declaredTotal} ≠ 받은 건수 ${ev.rawCount}`
      : "전체 건수를 알려 주는 근거 없음");
  }
  if (ev.manual && !ev.live) reasons.push("운영자 수동 입력(CSV) — 원천의 전체성은 입력자 책임");
  return { status, reasons, count: items.length, by_type: byType, missing_types: missingTypes, gaps };
}

/** 행사 기간이 대상 월과 겹치나. 기간을 모르면 겹친다고 본다(제외하지 않고 gaps 로만 센다) */
export function overlapsMonth(r, month) {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const last = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  if (r.start_date && r.start_date > last) return false;
  if (r.end_date && r.end_date < first) return false;
  return true;
}

/** 한국시간 기준 이번 달 "YYYY-MM" */
export const kstMonth = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 7);
export const kstStamp = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 19) + "+09:00";

/* ---------------- CSV ---------------- */

export function splitCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}
const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (items, fields = FIELDS) => "﻿" + [fields.join(","), ...items.map((r) => fields.map((f) => csvCell(r[f])).join(","))].join("\r\n") + "\r\n";

/** CSV 머리글 → 공통 필드. cvs-import.mjs 형식(편의점,상품명,가격,행사)과 확장 열 모두 받는다 */
const CSV_HEAD = {
  편의점: "_brand", brand: "_brand",
  상품명: "name", name: "name", 상품코드: "product_code", product_code: "product_code", 바코드: "barcode", barcode: "barcode",
  가격: "price", price: "price", 행사: "promo_type_raw", 행사유형: "promo_type_raw", promo_type_raw: "promo_type_raw",
  행사조건: "promo_condition", promo_condition: "promo_condition", 증정품: "gift_name", gift_name: "gift_name",
  증정품코드: "gift_code", gift_code: "gift_code", 증정품가격: "gift_price", gift_price: "gift_price",
  시작일: "start_date", start_date: "start_date", 종료일: "end_date", end_date: "end_date",
  분류: "category", category: "category", 이미지: "image_url", image_url: "image_url",
};
export function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], unknownHeaders: [] };
  const head = splitCsvLine(lines[0]).map((h) => h.replace(/\s/g, ""));
  const keys = head.map((h) => CSV_HEAD[h] || null);
  const unknownHeaders = head.filter((h, i) => !keys[i]);
  const rows = [];
  for (const l of lines.slice(1)) {
    const c = splitCsvLine(l);
    const o = {};
    keys.forEach((k, i) => { if (k) o[k] = c[i]; });
    if (o._brand && !/^(gs|지에스)/i.test(String(o._brand).replace(/\s/g, ""))) continue; // GS25 행만
    rows.push(o);
  }
  return { rows, unknownHeaders };
}

/* ---------------- HAR: 정제·구조 탐색·매핑 ---------------- */

const SECRET_HEADER = /^(cookie|set-cookie|authorization|proxy-authorization|x-.*(token|auth|key|session|sign|device|uuid).*)$/i;
const SECRET_PARAM = /(token|auth|key|session|sign|sig|secret|pass|uuid|device|phone|mobile|cust|member|user)/i;

/** URL 의 민감 쿼리값을 *** 로 */
export function maskUrl(u) {
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) if (SECRET_PARAM.test(k)) url.searchParams.set(k, "***");
    return url.toString();
  } catch { return String(u).split("?")[0]; }
}

/** HAR 에서 인증값 제거. 원본은 건드리지 않고 새 객체를 돌려준다 */
export function sanitizeHar(har) {
  const entries = (har?.log?.entries || []).map((e) => ({
    startedDateTime: e.startedDateTime,
    request: {
      method: e.request?.method,
      url: maskUrl(e.request?.url || ""),
      headers: (e.request?.headers || []).filter((h) => !SECRET_HEADER.test(h.name)),
      postData: e.request?.postData ? { mimeType: e.request.postData.mimeType, text: maskBody(e.request.postData.text) } : undefined,
    },
    response: {
      status: e.response?.status,
      headers: (e.response?.headers || []).filter((h) => !SECRET_HEADER.test(h.name)),
      content: { mimeType: e.response?.content?.mimeType, text: e.response?.content?.text, encoding: e.response?.content?.encoding },
    },
  }));
  return { log: { version: "1.2", creator: { name: "gs25-collect sanitize" }, entries } };
}
/** 요청 본문(JSON) 안의 민감 키 값 가리기 */
export function maskBody(text) {
  if (!text) return text;
  try {
    const walk = (v) => Array.isArray(v) ? v.map(walk) : v && typeof v === "object"
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SECRET_PARAM.test(k) ? "***" : walk(x)])) : v;
    return JSON.stringify(walk(JSON.parse(text)));
  } catch {
    return String(text).replace(/([?&]?)([\w.]*(?:token|auth|key|session|sign|secret|pass|uuid|device)[\w.]*)=([^&]*)/gi, "$1$2=***");
  }
}

export function entryJson(e) {
  const c = e.response?.content;
  if (!c?.text) return null;
  const t = c.encoding === "base64" ? Buffer.from(c.text, "base64").toString("utf8") : c.text;
  try { return JSON.parse(t); } catch { return null; }
}

const PAGING = /^(page|pageNo|pageNum|pageIndex|currentPage|totalCount|totalCnt|total|totalPage|totalPages|totCnt|count|size|pageSize|hasNext|hasMore|isLast|last|next|nextCursor|cursor|offset|limit)$/i;

/**
 * 응답 구조만 보고 값은 감춘 보고서. 사람이 이걸 보고 매핑 파일을 쓴다.
 * 배열이 크다고 '전체 행사 API'라고 단정하지 않는다 — 후보로만 나열한다.
 */
export function discover(har) {
  const out = [];
  for (const e of har?.log?.entries || []) {
    const j = entryJson(e);
    if (j === null) continue;
    const arrays = [], paging = [];
    const walk = (v, p, depth) => {
      if (depth > 6 || v === null) return;
      if (Array.isArray(v)) {
        const objs = v.filter((x) => x && typeof x === "object" && !Array.isArray(x));
        if (objs.length) {
          const keys = {};
          for (const o of objs.slice(0, 50)) for (const [k, x] of Object.entries(o)) keys[k] = keys[k] || shape(x);
          arrays.push({ path: p || "(root)", length: v.length, fields: keys });
          walk(objs[0], p + "[0]", depth + 1);
        }
        return;
      }
      if (typeof v === "object") for (const [k, x] of Object.entries(v)) {
        const q = p ? `${p}.${k}` : k;
        if (PAGING.test(k) && (typeof x === "number" || typeof x === "boolean")) paging.push({ path: q, value: x });
        else if (PAGING.test(k) && typeof x === "string") paging.push({ path: q, value: x.length > 12 ? `(문자열 ${x.length}자)` : x });
        walk(x, q, depth + 1);
      }
    };
    walk(j, "", 0);
    if (arrays.length || paging.length) out.push({ method: e.request?.method, url: maskUrl(e.request?.url || ""), status: e.response?.status, arrays, paging });
  }
  return out;
}
/** 값 모양만: 문자열은 길이와 패턴 종류, 숫자는 자릿수 */
function shape(x) {
  if (x === null) return "null";
  if (typeof x === "number") return `number(${String(Math.trunc(Math.abs(x))).length}자리)`;
  if (typeof x === "boolean") return "boolean";
  if (typeof x === "string") {
    const kind = /^\d+$/.test(x) ? "숫자문자" : /^https?:/.test(x) ? "URL" : /^\d{4}[-.]?\d{2}[-.]?\d{2}/.test(x) ? "날짜형" : /[+]/.test(x) && x.length <= 12 ? `짧은값:"${x}"` : "문자";
    return `string(${x.length}, ${kind})`;
  }
  return Array.isArray(x) ? "array" : "object";
}

/** "data.list[0].goods" 같은 경로 읽기 */
export function getPath(o, p) {
  if (!p) return o;
  return String(p).replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean).reduce((v, k) => (v == null ? undefined : v[k]), o);
}

/**
 * 매핑 파일 검사. 형식:
 * { "match": { "urlIncludes": "...", "method": "GET" },
 *   "itemsPath": "data.list", "totalPath": "data.totalCount"(선택),
 *   "fields": { "name": "응답키", "price": "응답키", "promo_type_raw": "응답키", ... },
 *   "promoMap": { "코드값": "1+1" }(선택),
 *   "request": { ...HTTP 소스용(선택) } }
 */
export function checkMapping(m) {
  const errs = [];
  if (!m || typeof m !== "object") return ["매핑이 객체가 아님"];
  if (!m.match?.urlIncludes) errs.push("match.urlIncludes 필요");
  if (!m.itemsPath && m.itemsPath !== "") errs.push("itemsPath 필요(루트 배열이면 빈 문자열)");
  if (!m.fields?.name) errs.push("fields.name 필요");
  if (!m.fields?.promo_type_raw && !m.fixedPromo) errs.push("fields.promo_type_raw 또는 fixedPromo(이 URL 이 한 유형만 돌려줄 때) 필요");
  const allowed = new Set(FIELDS);
  for (const k of Object.keys(m.fields || {})) if (!allowed.has(k)) errs.push(`fields.${k} 는 알 수 없는 출력 필드`);
  for (const v of Object.values(m.promoMap || {})) if (!NORM_TYPES.includes(v)) errs.push(`promoMap 값 "${v}" 는 ${NORM_TYPES.join("/")} 중 하나여야 함`);
  return errs;
}

/** 응답 JSON 한 개 → 원천 행들 + 서버가 밝힌 전체 건수 */
export function extractFromJson(json, m) {
  const arr = getPath(json, m.itemsPath);
  if (!Array.isArray(arr)) return { rows: [], total: null, ok: false };
  const rows = arr.filter((x) => x && typeof x === "object").map((it) => {
    const o = {};
    for (const [out, src] of Object.entries(m.fields)) o[out] = getPath(it, src);
    if (m.fixedPromo && !o.promo_type_raw) o.promo_type_raw = m.fixedPromo;
    return o;
  });
  const t = m.totalPath ? Number(getPath(json, m.totalPath)) : NaN;
  return { rows, total: Number.isInteger(t) ? t : null, ok: true };
}

export const matchEntry = (e, m) =>
  String(e.request?.url || "").includes(m.match.urlIncludes) && (!m.match.method || e.request?.method === m.match.method);

/** 차단·로그인 화면·빈 응답 감지 */
export function blockReason(status, contentType, text) {
  if (status === 401 || status === 403) return `HTTP ${status} (인증·접근 거부)`;
  if (status === 429) return "HTTP 429 (요청 제한)";
  if (status >= 500) return `HTTP ${status}`;
  const t = String(text || "");
  if (!t.trim()) return "빈 응답";
  if (/json/i.test(contentType || "") === false && /<html|<!doctype/i.test(t)) {
    if (/captcha|로봇|robot|access denied|차단|blocked/i.test(t)) return "차단 페이지(HTML)";
    return "JSON 대신 HTML 응답";
  }
  return null;
}

/* ---------------- UI 덤프(화면에 보이는 글자) → 상품 레코드 ----------------
 * 통신을 가로채지 않는다. adb uiautomator dump 가 만든 XML(접근성 트리)의 text 속성만 읽는다.
 * 두 모드:
 *   resId : 설정(ui-config)의 자원ID 로 상품 카드·이름·가격·행사 노드를 정확히 집는다(실제 덤프 1개 보면 이걸로 고정).
 *   bounds: 설정이 없을 때 좌표로 묶는 임시 모드 — 가격 노드를 기준으로 가까운 이름·행사 글자를 붙인다.
 */

const PRICE_RX = /^\s*[₩]?\s*([\d][\d,]{1,8})\s*원?\s*$/;
const PROMO_RX = /(\d\s*\+\s*\d|덤\s*증정|덤행사|증정행사|^덤$|^증정$|1\+1|2\+1|3\+1)/;

/** uiautomator XML 의 모든 노드를 좌표와 함께. withEmpty=true 면 글자 없는 컨테이너(카드)도 포함 */
export function parseUiNodes(xml, withEmpty = false) {
  const nodes = [];
  const re = /<node\b([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const text = decodeXml(attr(attrs, "text")).trim();
    if (!text && !withEmpty) continue;
    nodes.push({
      text,
      resId: attr(attrs, "resource-id") || "",
      cls: attr(attrs, "class") || "",
      desc: decodeXml(attr(attrs, "content-desc")) || "",
      ...parseBounds(attr(attrs, "bounds")),
    });
  }
  return nodes;
}
/** 화면에 보이는 글자 노드만(빈 것 제외) */
export const parseUiDump = (xml) => parseUiNodes(xml, false);
const attr = (s, name) => { const m = s.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : ""; };
const decodeXml = (s) => String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
function parseBounds(s) {
  const m = String(s).match(/\[(\-?\d+),(\-?\d+)\]\[(\-?\d+),(\-?\d+)\]/);
  if (!m) return { x1: 0, y1: 0, x2: 0, y2: 0, cx: 0, cy: 0 };
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}

/** 개인정보로 보이는 글자(화면 상단 내 정보 등) — 수집 레코드에 섞이면 안 되므로 가격 짝 찾기에서 제외 */
export const PERSONAL_RX = /(\d{3,4}[-\s]?\d{3,4}[-\s]?\d{4})|(\d{1,3}(,\d{3})*\s*P\b)|(포인트|적립금|마이|내\s?지갑|님\s|로그아웃|바코드)/;

/**
 * 덤프 여러 장(스크롤하며 찍은) → 원천 행들. 같은 상품이 여러 장에 겹쳐 나오면 dedupe 가 합친다.
 * @param dumps [{ xml, tab?: "1+1"|"2+1"|"덤" }]  tab 은 어느 탭에서 찍었는지(행사 유형 보강용, 있으면)
 * @param cfg   ui-config(없으면 bounds 모드). { resId:{card,name,price,promo,gift}, rowGap?, cardWidth? }
 */
export function uiExtract(dumps, cfg = {}) {
  const rows = [];
  const diag = { dumps: dumps.length, textNodes: 0, priceNodes: 0, cards: 0, dropped_personal: 0, mode: cfg.resId ? "resId" : "bounds" };
  for (const d of dumps) {
    const all = parseUiNodes(d.xml, true);
    diag.textNodes += all.filter((n) => n.text).length;
    const got = cfg.resId?.card ? byResId(all, cfg, d.tab, diag) : byBounds(all.filter((n) => n.text), cfg, d.tab, diag);
    rows.push(...got);
  }
  diag.rawRows = rows.length;
  return { rows, diag };
}

// 정밀 모드: 카드 컨테이너(resId=card) bounds 안에 든 글자 노드를 이름/가격/행사 자원ID 로 집는다
function byResId(all, cfg, tab, diag) {
  const r = cfg.resId;
  const idEnds = (n, want) => want && n.resId.endsWith(want);
  const cards = all.filter((n) => idEnds(n, r.card));
  diag && (diag.cards += cards.length);
  const out = [];
  for (const card of cards) {
    const inside = all.filter((n) => n.text && within(n, card));
    const nameN = inside.find((n) => idEnds(n, r.name));
    const priceN = inside.find((n) => idEnds(n, r.price));
    const promoN = inside.find((n) => idEnds(n, r.promo));
    const giftN = r.gift ? inside.find((n) => idEnds(n, r.gift)) : null;
    if (!nameN && !priceN) continue;
    out.push(mkRow(nameN?.text, priceN?.text, promoN?.text || promoN?.desc, giftN?.text, tab));
  }
  return out.filter(Boolean);
}
// 자식 노드 중심이 카드 bounds 안에 있나(미세 오차 허용)
const within = (n, card) => n.cx >= card.x1 - 2 && n.cx <= card.x2 + 2 && n.cy >= card.y1 - 2 && n.cy <= card.y2 + 2;

// 임시 모드: 가격 노드마다 같은 카드로 보이는 이름·행사 글자를 좌표로 붙인다
function byBounds(nodes, cfg, tab, diag) {
  const prices = nodes.filter((n) => { const m = n.text.match(PRICE_RX); return m && Number(m[1].replace(/,/g, "")) >= 100 && !PERSONAL_RX.test(n.text); });
  diag.priceNodes += prices.length;
  const gapY = cfg.rowGap || 220; // 가격 위/아래로 한 카드로 볼 세로 범위(px). 실제 덤프로 보정.
  const out = [];
  for (const p of prices) {
    const near = nodes.filter((n) => n !== p && Math.abs(n.cy - p.cy) <= gapY && horizOverlap(n, p, cfg));
    const promoN = near.find((n) => PROMO_RX.test(n.text)) || near.find((n) => PROMO_RX.test(n.desc));
    // 이름: 가격·행사·개인정보가 아니고 글자수 2 이상, 가격과 가장 가까운(주로 바로 위) 것
    const nameCands = near.filter((n) => !PRICE_RX.test(n.text) && !PROMO_RX.test(n.text) && n.text.replace(/\s/g, "").length >= 2 && !PERSONAL_RX.test(n.text));
    if (PERSONAL_RX.test(p.text)) { diag.dropped_personal++; continue; }
    const nameN = nameCands.sort((a, b) => dist(a, p) - dist(b, p))[0];
    if (!nameN) continue;
    out.push(mkRow(nameN.text, p.text, promoN?.text || promoN?.desc, null, tab));
  }
  return out.filter(Boolean);
}
const horizOverlap = (a, b, cfg) => cfg.cardWidth ? Math.abs(a.cx - b.cx) <= cfg.cardWidth : (a.x1 <= b.x2 && a.x2 >= b.x1) || Math.abs(a.cx - b.cx) <= 260;
const dist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

function mkRow(name, price, promoRaw, gift, tab) {
  if (!name && !price) return null;
  let raw = promoRaw ? String(promoRaw).replace(/\s+/g, "") : null;
  if (raw) { const m = raw.match(/(\d\+\d)/); if (m) raw = m[1]; else if (/덤|증정/.test(raw)) raw = "덤"; }
  if (!raw && tab) raw = tab; // 탭에서 찍었으면 그 유형으로 보강(단, 화면 배지가 우선)
  return { name, price: price ? String(price).match(PRICE_RX)?.[1] : null, promo_type_raw: raw, gift_name: gift || null, source_screen: tab || null };
}

/**
 * 덤프에서 탭 버튼 위치 찾기(좌표 하드코딩 없이 탭 전환하려고). label 과 글자가 정확히 같은 노드 중,
 * resIdHint(예 "tab")가 resource-id 에 든 것을 먼저, 없으면 화면 위쪽(작은 y) 것을 고른다.
 * 행사 배지(tvEvent)도 "1+1" 이라 label 만으로는 안 되므로 hint 로 가른다.
 * @returns {cx,cy} 또는 null
 */
export function findTab(nodes, label, resIdHint = "tab") {
  const want = String(label).replace(/\s/g, "");
  const hits = nodes.filter((n) => n.text.replace(/\s/g, "") === want && (n.x2 > n.x1));
  if (!hits.length) return null;
  const byHint = resIdHint ? hits.filter((n) => n.resId.toLowerCase().includes(resIdHint.toLowerCase())) : [];
  const pick = (byHint.length ? byHint : hits).sort((a, b) => a.cy - b.cy)[0];
  return { cx: Math.round(pick.cx), cy: Math.round(pick.cy) };
}
