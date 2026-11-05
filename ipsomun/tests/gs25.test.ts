// GS25 수집기 — 합성 데이터(tests/fixtures/gs25, 실제 GS25 응답 아님)로 파서·정규화·검증·출력을 시험한다
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
// @ts-ignore — 순수 JS 모듈
import * as L from "../scripts/gs25/lib.mjs";

const FX = path.join(import.meta.dirname, "fixtures", "gs25");
const CLI = path.join(import.meta.dirname, "..", "scripts", "gs25-collect.mjs");
const run = (...a: string[]) => spawnSync(process.execPath, [CLI, ...a], { encoding: "utf8" });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "gs25-"));
const ctx = { month: "2026-11", collected_at: "t", source: "test" };

test("행사 유형: 정확한 1+1·2+1·3+1·덤만 정규화, 2+2·할인·페이백·쿠폰은 null", () => {
  for (const [raw, want] of [["1+1", "1+1"], ["1 + 1", "1+1"], ["2+1행사", "2+1"], ["3+1", "3+1"], ["덤증정", "덤"], ["증정", "덤"],
    ["2+2", null], ["1+2", null], ["12+1", null], ["묶음할인", null], ["페이백", null], ["쿠폰", null], ["50%", null], ["1+1 쿠폰", null], ["", null]] as const)
    assert.equal(L.normPromo(raw), want, raw);
  assert.equal(L.normPromo("ONE_PLUS_ONE", { ONE_PLUS_ONE: "1+1" }), "1+1");
  assert.equal(L.normPromo("ONE_PLUS_ONE"), null); // 표에 없으면 추측하지 않음
});

test("모르는 값은 null, 날짜·가격 정리", () => {
  const r = L.makeRecord({ name: " 콜라  ", promo_type_raw: "1+1", price: "2,000원", start_date: "2026.11.1" }, ctx);
  assert.equal(r.name, "콜라"); assert.equal(r.price, 2000); assert.equal(r.start_date, "2026-11-01");
  assert.equal(r.end_date, null); assert.equal(r.product_code, null); assert.equal(r.gift_name, null);
  assert.equal(L.makeRecord({ name: "x", promo_type_raw: "2+2" }, ctx).promo_class, "other");
});

test("중복: 상품코드만으로 묶지 않는다(유형·증정품이 다르면 별개)", () => {
  const a = L.makeRecord({ product_code: "1", name: "콜라", promo_type_raw: "1+1", price: 2000 }, ctx);
  const b = L.makeRecord({ product_code: "1", name: "콜라", promo_type_raw: "1+1", price: 2000 }, ctx);
  const c = L.makeRecord({ product_code: "1", name: "콜라", promo_type_raw: "덤", gift_name: "쿠키", price: 2000 }, ctx);
  const d = L.makeRecord({ product_code: "1", name: "콜라", promo_type_raw: "덤", gift_name: "사탕", price: 2000 }, ctx);
  const r = L.dedupe([a, b, c, d, L.makeRecord({ name: "", promo_type_raw: "1+1" }, ctx)]);
  assert.equal(r.items.length, 3); assert.equal(r.duplicates, 1); assert.equal(r.rejected.length, 1);
  assert.equal(r.products_with_multiple_promos, 1);
});

test("비교: 추가·변경·종료와 유형 변경", () => {
  const m = (o: object) => L.makeRecord(o, ctx);
  const prev = [m({ product_code: "1", name: "콜라", promo_type_raw: "2+1", price: 2000 }), m({ product_code: "2", name: "라면", promo_type_raw: "1+1", price: 1500 })];
  const cur = [m({ product_code: "1", name: "콜라", promo_type_raw: "1+1", price: 2000 }), m({ product_code: "2", name: "라면", promo_type_raw: "1+1", price: 1600 })];
  const d = L.diffRecords(prev, cur);
  assert.equal(d.added.length, 1); assert.equal(d.ended.length, 1); assert.equal(d.changed.length, 1);
  assert.deepEqual(d.changed[0].fields, ["price"]);
  assert.deepEqual(d.type_changed[0], { product: "콜라", before: "2+1", after: "1+1" });
});

test("완료 판정: 샘플은 미완료, 덤 없으면 일부 누락, 전체 건수 근거 있어야 전체 완료", () => {
  const m = (t: string, extra = {}) => L.makeRecord({ name: t, promo_type_raw: t, price: 1000, start_date: "2026-11-01", end_date: "2026-11-30", ...extra }, ctx);
  const full = [m("1+1"), m("2+1"), m("덤", { gift_name: "쿠키" })];
  assert.equal(L.assess(full, { sample: true, month: "2026-11" }).status, L.STATUS.BLOCKED);
  assert.equal(L.assess([], { live: true }).status, L.STATUS.BLOCKED);
  assert.equal(L.assess(full.slice(0, 2), { live: true }).status, L.STATUS.PARTIAL);
  assert.equal(L.assess([m("1+1"), m("2+1"), m("덤")], { live: true }).status, L.STATUS.PARTIAL); // 덤 증정품 없음
  assert.equal(L.assess(full, { live: true }).status, L.STATUS.OBSERVED);
  assert.equal(L.assess(full, { live: true, declaredTotal: 3, rawCount: 3 }).status, L.STATUS.FULL);
  assert.equal(L.assess(full, { live: true, declaredTotal: 9, rawCount: 3 }).status, L.STATUS.OBSERVED);
  assert.equal(L.assess(full, { live: true, failures: 1, declaredTotal: 3, rawCount: 3 }).status, L.STATUS.PARTIAL);
});

test("HAR 정제: 쿠키·인증 헤더·토큰 쿼리 제거, 구조 탐색은 값을 가린다", () => {
  const har = JSON.parse(fs.readFileSync(path.join(FX, "synthetic.har"), "utf8"));
  const clean = JSON.stringify(L.sanitizeHar(har).log.entries.map((e: any) => e.request).concat(L.sanitizeHar(har).log.entries.map((e: any) => e.response.headers)));
  assert.ok(!clean.includes("SECRET_SHOULD_VANISH"));
  const rep = L.discover(L.sanitizeHar(har));
  const promo = rep.find((x: any) => x.url.includes("/promo/list"));
  assert.equal(promo.arrays[0].path, "result.list");
  assert.ok(promo.arrays[0].fields.gdNm.startsWith("string("));
  assert.ok(!JSON.stringify(rep).includes("테스트콜라")); // 상품 값은 보고서에 안 나옴
  assert.deepEqual(promo.paging[0], { path: "result.total", value: 5 });
});

test("매핑 검사: 필수 키·허용 필드·promoMap 값", () => {
  assert.deepEqual(L.checkMapping(JSON.parse(fs.readFileSync(path.join(FX, "synthetic.map.json"), "utf8"))), []);
  const e = L.checkMapping({ match: {}, fields: { nope: "x" }, promoMap: { A: "2+2" } });
  assert.ok(e.length >= 4);
});

test("차단 감지", () => {
  assert.match(L.blockReason(403, "text/html", "<html>"), /403/);
  assert.match(L.blockReason(200, "text/html", "<!doctype html><title>Access Denied</title>"), /차단/);
  assert.equal(L.blockReason(200, "application/json", "{}"), null);
  assert.equal(L.blockReason(200, "application/json", " "), "빈 응답");
});

test("CLI: 합성 HAR 한 번에 수집 → JSON·CSV·run.json, 샘플은 '실제 수집 미완료'(종료코드 3)", () => {
  const out = tmp();
  const r = run("--source=har", `--in=${path.join(FX, "synthetic.har")}`, `--map=${path.join(FX, "synthetic.map.json")}`, "--month=2026-11", "--sample", `--out=${out}`, "--prev=/nonexistent");
  assert.equal(r.status, 3, r.stderr + r.stdout);
  const j = JSON.parse(fs.readFileSync(path.join(out, "promotions.json"), "utf8"));
  assert.equal(j.items.length, 4); // 5행 중 1행 중복
  const run1 = JSON.parse(fs.readFileSync(path.join(out, "run.json"), "utf8"));
  assert.equal(run1.status, L.STATUS.BLOCKED); assert.equal(run1.sample, true);
  assert.equal(run1.declared_total, 5); assert.equal(run1.raw_rows, 5);
  assert.deepEqual(run1.by_type, { "1+1": 1, "2+1": 1, "3+1": 0, "덤": 1, other: 1 });
  const other = j.items.find((x: any) => x.promo_type_raw === "TWO_PLUS_TWO");
  assert.equal(other.promo_type_norm, null); // 2+2 를 1+1·2+1 로 바꾸지 않음
  const gift = j.items.find((x: any) => x.promo_type_norm === "덤");
  assert.equal(gift.gift_name, "합성)테스트쿠키");
  const csv = fs.readFileSync(path.join(out, "promotions.csv"), "utf8");
  assert.ok(csv.startsWith("﻿target_month,brand,product_code"));
  assert.ok(!fs.readFileSync(path.join(out, "run.json"), "utf8").includes("SECRET"));
});

test("CLI: CSV 입력 + 이전 결과 비교(diff.json), GS25 행만", () => {
  const out1 = tmp(), out2 = tmp();
  run("--source=har", `--in=${path.join(FX, "synthetic.har")}`, `--map=${path.join(FX, "synthetic.map.json")}`, "--month=2026-11", "--sample", `--out=${out1}`, "--prev=/nonexistent");
  const r = run("--source=csv", `--in=${path.join(FX, "synthetic.csv")}`, "--month=2026-11", "--sample", `--out=${out2}`, `--prev=${path.join(out1, "promotions.json")}`);
  assert.equal(r.status, 3, r.stderr);
  const j = JSON.parse(fs.readFileSync(path.join(out2, "promotions.json"), "utf8"));
  assert.equal(j.items.length, 4); // CU 행 제외
  assert.equal(j.items.find((x: any) => x.promo_type_raw === "묶음할인").promo_type_norm, null);
  const d = JSON.parse(fs.readFileSync(path.join(out2, "diff.json"), "utf8"));
  assert.ok(d.added.some((x: any) => x.name === "합성)테스트우유"));
  assert.ok(d.ended.some((x: any) => x.name === "합성)테스트라면"));
});

test("CLI: 매핑 오류·잘못된 월은 종료코드 1", () => {
  assert.equal(run("--source=har", "--month=2026-13").status, 1);
  const bad = path.join(tmp(), "m.json"); fs.writeFileSync(bad, "{}");
  assert.equal(run("--source=har", `--in=${path.join(FX, "synthetic.har")}`, `--map=${bad}`).status, 1);
});

// 로컬 가짜 서버(합성)로 http 소스: 페이지 넘김·5xx 재시도·전체 건수·403 중단·이어받기
import http from "node:http";
import { execFile } from "node:child_process";
const runAsync = (...a: string[]) => new Promise<{ code: number; out: string }>((ok) =>
  execFile(process.execPath, [CLI, ...a], { encoding: "utf8" }, (e: any, so, se) => ok({ code: e ? e.code : 0, out: so + se })));

test("CLI http: 페이지 넘김·재시도·전체 건수 검증 → 실제 조회 판정 경로", async () => {
  const types = ["1+1", "2+1", "덤"];
  const all = Array.from({ length: 7 }, (_, i) => ({ c: `H${i}`, n: `합성)상품${i}`, p: 1000 + i, t: types[i % 3], g: i % 3 === 2 ? "합성)증정" : null, s: "2026-11-01", e: "2026-11-30" }));
  let fail500 = 1, forbid = false;
  const hits: string[] = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url!, "http://x");
    hits.push(u.search);
    if (forbid) { res.writeHead(403, { "content-type": "text/html" }); return res.end("<html>denied</html>"); }
    const page = Number(u.searchParams.get("page"));
    if (page === 2 && fail500-- > 0) { res.writeHead(503); return res.end("busy"); }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ d: { total: all.length, rows: all.slice((page - 1) * 3, page * 3) } }));
  });
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", () => ok()));
  const port = (srv.address() as any).port;
  const dir = tmp();
  const map = path.join(dir, "map.json");
  fs.writeFileSync(map, JSON.stringify({ match: { urlIncludes: "/list" }, itemsPath: "d.rows", totalPath: "d.total",
    fields: { product_code: "c", name: "n", price: "p", promo_type_raw: "t", gift_name: "g", start_date: "s", end_date: "e" },
    request: { url: `http://127.0.0.1:${port}/list?page={page}&size={size}`, pageSize: 3, delayMs: 500 } }));
  try {
    const out = path.join(dir, "o");
    const r = await runAsync("--source=http", `--map=${map}`, "--month=2026-11", `--out=${out}`, "--prev=/nonexistent");
    const run1 = JSON.parse(fs.readFileSync(path.join(out, "run.json"), "utf8"));
    assert.equal(r.code, 0, r.out);
    assert.equal(run1.status, L.STATUS.FULL); // 로컬 합성 서버가 밝힌 total 7 = 받은 7
    assert.equal(run1.raw_rows, 7);
    assert.equal(hits.filter((h) => h.includes("page=2")).length, 2); // 503 한 번 → 재시도
    // 이어받기: 서버가 막혀도 저장된 페이지로 다시 만든다(새 요청 없음)
    forbid = true; hits.length = 0;
    const r2 = await runAsync("--source=http", `--map=${map}`, "--month=2026-11", `--out=${out}`, "--prev=/nonexistent", "--resume");
    assert.equal(r2.code, 0, r2.out); assert.equal(hits.length, 0);
    // 처음부터: 403 이면 우회하지 않고 멈춤 → 미완료(3)
    const out3 = path.join(dir, "o3");
    const r3 = await runAsync("--source=http", `--map=${map}`, "--month=2026-11", `--out=${out3}`, "--prev=/nonexistent");
    assert.equal(r3.code, 3, r3.out); assert.equal(hits.length, 1);
    assert.match(JSON.parse(fs.readFileSync(path.join(out3, "failures.json"), "utf8")).failures[0].reason, /403/);
  } finally { srv.close(); }
});

test("UI 덤프: 화면 글자 파싱, 개인정보 노드 제외", () => {
  const xml = fs.readFileSync(path.join(FX, "synthetic-ui-1+1.xml"), "utf8");
  const nodes = L.parseUiDump(xml);
  assert.ok(nodes.find((n: any) => n.text === "몬스터 울트라 355ml"));
  assert.ok(nodes.find((n: any) => n.text === "홍길동님 · 1,250 P")); // 파싱은 되지만
  assert.ok(L.PERSONAL_RX.test("홍길동님 · 1,250 P")); // 가격 짝 찾기에서 걸러짐
});

test("UI 덤프: resId 모드로 상품 추출", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "scripts", "gs25", "ui-config.example.json"), "utf8"));
  const dumps = [{ xml: fs.readFileSync(path.join(FX, "synthetic-ui-1+1.xml"), "utf8"), tab: "1+1" }];
  const { rows } = L.uiExtract(dumps, cfg);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { name: "몬스터 울트라 355ml", price: "2,700", promo_type_raw: "1+1", gift_name: null, source_screen: "1+1" });
});

test("UI 덤프: bounds 모드(설정 없이 좌표)로도 뽑고 개인정보 가격 제외", () => {
  const dumps = [{ xml: fs.readFileSync(path.join(FX, "synthetic-ui-1+1.xml"), "utf8"), tab: "1+1" }];
  const { rows, diag } = L.uiExtract(dumps, {});
  assert.equal(diag.mode, "bounds");
  assert.equal(rows.length, 2); // 1,250 P 는 가격 후보에서 빠짐
  assert.ok(rows.every((r: any) => r.promo_type_raw === "1+1"));
  assert.ok(rows.find((r: any) => r.name === "몬스터 울트라 355ml" && r.price === "2,700"));
});

test("CLI ui: 덤프 폴더 2장 → 겹친 상품은 중복 제거, 탭명으로 유형 보강", () => {
  const dir = tmp();
  for (const f of ["synthetic-ui-1+1.xml", "synthetic-ui-1+1-b.xml"]) fs.copyFileSync(path.join(FX, f), path.join(dir, f));
  const cfg = path.join(dir, "cfg.json");
  fs.copyFileSync(path.join(import.meta.dirname, "..", "scripts", "gs25", "ui-config.example.json"), cfg);
  const out = tmp();
  const r = run("--source=ui", `--in=${dir}`, `--ui-config=${cfg}`, "--month=2026-11", `--out=${out}`, "--prev=/nonexistent");
  const j = JSON.parse(fs.readFileSync(path.join(out, "promotions.json"), "utf8"));
  // 1+1.xml: 몬스터·불닭 / b.xml: 불닭(중복)·콜라·홈런볼 → 4종
  assert.equal(j.items.length, 4, JSON.stringify(j.items.map((x: any) => x.name)));
  assert.ok(j.items.every((x: any) => x.promo_type_norm === "1+1"));
  const run1 = JSON.parse(fs.readFileSync(path.join(out, "run.json"), "utf8"));
  assert.equal(run1.ui.dumps, 2);
  assert.equal(run1.ui.mode, "resId");
  // 실측이지만 전체 건수 근거 없음 → 관측 범위. 단 2+1·덤 유형이 없어 '일부 누락'으로 떨어짐
  assert.equal(run1.status, L.STATUS.PARTIAL);
  assert.ok(run1.reasons.some((x: string) => /유형 누락/.test(x)));
  assert.equal(r.status, 2, r.stderr);
});

test("UI 덤프: 탭 버튼 좌표 찾기(행사 배지와 구분)", () => {
  const nodes = L.parseUiDump(fs.readFileSync(path.join(FX, "synthetic-ui-1+1.xml"), "utf8"));
  const t = L.findTab(nodes, "1+1", "tab"); // tabName 노드(위쪽) 선택, tvEvent 배지 아님
  assert.deepEqual(t, { cx: 120, cy: 250 });
  assert.equal(L.findTab(nodes, "없는탭"), null);
});
