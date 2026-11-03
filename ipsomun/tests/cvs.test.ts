import test from "node:test";
import assert from "node:assert/strict";
import { diffMonths, crossBrand, unitPrice, normName, type CvsItem } from "../lib/cvs.ts";

const it = (b: CvsItem["b"], n: string, p: number, t: CvsItem["t"]): CvsItem => ({ b, n, p, t });

test("1개당 가격: 1+1 절반, 2+1 2/3", () => {
  assert.equal(unitPrice({ p: 2700, t: "1+1" }), 1350);
  assert.equal(unitPrice({ p: 2700, t: "2+1" }), 1800);
});

test("표기가 달라도 같은 상품", () => {
  assert.equal(normName("몬스터)울트라 355ML"), normName("몬스터 울트라355ml"));
  assert.notEqual(normName("몬스터 355ml"), normName("몬스터 250ml"));
});

test("2+1 → 1+1 은 버프, 반대는 너프, 사라지면 종료, 생기면 신규", () => {
  const prev = [it("gs25", "몬스터 울트라", 2700, "2+1"), it("cu", "몬스터 울트라", 2700, "1+1"), it("cu", "핫식스", 1500, "2+1")];
  const cur = [it("gs25", "몬스터 울트라", 2700, "1+1"), it("cu", "몬스터 울트라", 2700, "2+1"), it("seven", "레드불", 2800, "1+1")];
  const d = diffMonths(prev, cur);
  const by = (k: string, b: string) => d.find((x) => x.kind === k && x.b === b);
  assert.ok(by("buff", "gs25"));
  assert.ok(by("nerf", "cu"));
  assert.equal(by("ended", "cu")?.n, "핫식스");
  assert.equal(by("new", "seven")?.n, "레드불");
  assert.equal(Math.round(by("buff", "gs25")!.pct * 100), -25);
});

test("같은 상품 어디가 이득", () => {
  const x = crossBrand([it("gs25", "몬스터 울트라", 2700, "1+1"), it("cu", "몬스터)울트라", 2700, "2+1")]);
  assert.equal(x.length, 1);
  assert.equal(x[0].offers[0].b, "gs25");
  assert.equal(x[0].save, 450);
});

test("행사 종류가 바뀐 변화가 정가만 바뀐 변화보다 먼저", () => {
  const prev = [it("cu", "A상품", 3000, "1+1"), it("gs25", "B상품", 2000, "2+1")];
  const cur = [it("cu", "A상품", 1000, "1+1"), it("gs25", "B상품", 2000, "1+1")];
  const d = diffMonths(prev, cur);
  assert.equal(d[0].n, "B상품"); // -25% 지만 2+1→1+1 이라 먼저
  assert.equal(d[0].typeChanged, true);
  assert.equal(d[1].typeChanged, false);
});

test("상품 분류", async () => {
  const { categoryOf } = await import("../lib/cvs.ts");
  const cases: [string, string][] = [
    ["덴마크)초코초코우유300ml", "음료"],
    ["오비)카스레몬스퀴즈7.0캔500ml*4입", "주류"],
    ["하이트)제로(무알콜)캔350ml", "음료"],
    ["CJ)맥스봉빅소시지150g", "간편식"],
    ["오뚜기)참기름김치볶음밥", "간편식"],
    ["프링글스)스윗어니언100g", "과자·간식"],
    ["빙그레)메로나", "아이스크림"],
    ["리스테린)그린티100ml", "생활용품"],
    ["청정원)까나리액젓500G", "기타"],
  ];
  for (const [n, c] of cases) assert.equal(categoryOf(n), c, n);
});

test("쿠팡 검색어 정리", async () => {
  const { coupangQuery } = await import("../lib/cvs.ts");
  assert.equal(coupangQuery("덴마크)초코초코우유300ml"), "덴마크 초코초코우유 300ml");
  assert.equal(coupangQuery("풀무원)샘물펫500ml*20입(QR)"), "풀무원 샘물펫 500ml 20입");
});

test("분류 — 생활용품·국 오분류 방지", async () => {
  const { categoryOf } = await import("../lib/cvs.ts");
  assert.equal(categoryOf("홈스타)뿌리는곰팡이싹900ml"), "생활용품");
  assert.equal(categoryOf("CJ)소고기듬뿍무국500g"), "간편식");
  assert.equal(categoryOf("오뚜기)한우미역국500g"), "간편식");
});
