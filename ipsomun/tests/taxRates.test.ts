// 세율 상수 회귀 테스트 — 연초·7월 갱신 때 하나라도 빠뜨리면 여기서 걸린다.
// 실행: npm test  (Node 22 의 --experimental-strip-types 로 TS 를 그대로 돌린다)
import test from "node:test";
import assert from "node:assert/strict";
import {
  INSURANCE,
  MIN_WAGE_HOURLY,
  RATE_YEAR,
  UNEMPLOYMENT,
  childTaxCredit,
  progressiveTax,
  earnedIncomeDeduction,
} from "../lib/taxRates.ts";

// 한국시간 1월 1일에 요율표가 저절로 넘어간다(lib/taxRates.ts YEARLY) — 그해 값을 확인한다
const EXPECT = {
  2026: { pension: 0.0475, health: 0.03595, ltc: 0.1314, minWage: 10_320 },
  2027: { pension: 0.05, health: 0.03595, ltc: 0.139, minWage: 10_700 },
};

test(`${RATE_YEAR} 4대보험 근로자 부담 요율·최저임금`, () => {
  const e = EXPECT[RATE_YEAR];
  assert.equal(INSURANCE.pension, e.pension);
  assert.equal(INSURANCE.health, e.health);
  assert.equal(INSURANCE.longTermCareOnHealth, e.ltc);
  assert.equal(INSURANCE.employment, 0.009);
  assert.equal(MIN_WAGE_HOURLY, e.minWage);
});

// 2027년엔 하한(68,480)이 상한(68,100)을 넘는다. 현행 시행령은 그때 하한액을 주므로 계산기(상한으로 자른 뒤
// 하한으로 올림)가 맞다. 예전엔 '하한 ≤ 상한'을 강제했는데, 그러면 1월 1일부터 CI 가 매일 빨개진다.
// 상한 연동 개편안이 확정되면 UNEMPLOYMENT 와 이 테스트를 함께 고칠 것.
test("실업급여 일액: 상한으로 자르고 하한으로 받친다 (하한>상한이면 하한)", () => {
  const daily = (raw: number) => Math.max(Math.min(raw, UNEMPLOYMENT.dailyCap), UNEMPLOYMENT.dailyFloor);
  assert.equal(daily(1_000_000), Math.max(UNEMPLOYMENT.dailyCap, UNEMPLOYMENT.dailyFloor));
  assert.equal(daily(1), UNEMPLOYMENT.dailyFloor);
  assert.equal(UNEMPLOYMENT.dailyFloor, Math.round(MIN_WAGE_HOURLY * 0.8 * 8));
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
  assert.equal(payFromHourly(10_700, 8, 5).monthly, 2_236_300); // 2027 고시 월 환산액
});
