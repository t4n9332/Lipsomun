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

test("연말정산 특별세액공제·월세", async () => {
  const t = await import("../lib/taxRates.ts");
  assert.equal(t.insurancePremiumCredit(1_500_000), 120_000);
  // 총급여 5천만원 → 3% 문턱 150만원, 300만원 쓰면 150만원 × 15%
  assert.equal(t.medicalExpenseCredit(3_000_000, 50_000_000), 225_000);
  assert.equal(t.medicalExpenseCredit(1_000_000, 50_000_000), 0);
  assert.equal(t.educationCredit(3_000_000), 450_000);
  assert.equal(t.donationCredit(12_000_000), 1_500_000 + 600_000);
  assert.equal(t.rentCredit(6_000_000, 50_000_000), 1_020_000);
  assert.equal(t.rentCredit(12_000_000, 70_000_000), 1_500_000);
  assert.equal(t.rentCredit(6_000_000, 90_000_000), 0);
});

test("시급 → 월급·주휴수당 (2026 최저임금)", async () => {
  const { payFromHourly, weeklyHolidayHours } = await import("../lib/taxRates.ts");
  const r = payFromHourly(10_320, 8, 5);
  assert.equal(r.monthlyHours, 209);
  assert.equal(r.monthly, 2_156_880); // 고용노동부 고시 월 환산액
  assert.equal(r.holidayHours, 8);
  assert.equal(weeklyHolidayHours(14), 0); // 주 15시간 미만은 주휴 없음
  assert.equal(weeklyHolidayHours(20), 4); // 비례
  assert.equal(payFromHourly(10_000, 4, 5).belowMinimum, true);
});
