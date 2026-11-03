// 세율 상수 회귀 테스트 — 연초·7월 갱신 때 하나라도 빠뜨리면 여기서 걸린다.
// 실행: npm test  (Node 22 의 --experimental-strip-types 로 TS 를 그대로 돌린다)
import test from "node:test";
import assert from "node:assert/strict";
import {
  INSURANCE,
  UNEMPLOYMENT,
  childTaxCredit,
  progressiveTax,
  earnedIncomeDeduction,
} from "../lib/taxRates.ts";

test("2026 4대보험 근로자 부담 요율", () => {
  assert.equal(INSURANCE.pension, 0.0475);
  assert.equal(INSURANCE.health, 0.03595);
  assert.equal(INSURANCE.longTermCareOnHealth, 0.1314);
  assert.equal(INSURANCE.employment, 0.009);
});

test("실업급여 하한이 상한을 넘지 않는다", () => {
  assert.ok(
    UNEMPLOYMENT.dailyFloor <= UNEMPLOYMENT.dailyCap,
    `하한 ${UNEMPLOYMENT.dailyFloor} > 상한 ${UNEMPLOYMENT.dailyCap} — 상한 갱신 필요`,
  );
});

test("자녀세액공제: 25만 / 55만 / 셋째부터 40만씩", () => {
  assert.equal(childTaxCredit(0), 0);
  assert.equal(childTaxCredit(1), 250_000);
  assert.equal(childTaxCredit(2), 550_000);
  assert.equal(childTaxCredit(3), 950_000);
  assert.equal(childTaxCredit(4), 1_350_000);
});

test("누진세 구간 경계가 연속이다", () => {
  for (const edge of [14_000_000, 50_000_000, 88_000_000, 150_000_000]) {
    const below = progressiveTax(edge);
    const above = progressiveTax(edge + 1);
    assert.ok(above - below < 1, `${edge} 경계에서 세액이 튄다`);
  }
});

test("근로소득공제 한도 2천만원", () => {
  assert.equal(earnedIncomeDeduction(1_000_000_000), 20_000_000);
});

test("노란우산공제 한도 (2025 귀속 상향)", async () => {
  const { noranUmbrellaCap } = await import("../lib/taxRates.ts");
  assert.equal(noranUmbrellaCap(30_000_000), 6_000_000);
  assert.equal(noranUmbrellaCap(80_000_000), 4_000_000);
  assert.equal(noranUmbrellaCap(200_000_000), 2_000_000);
});
