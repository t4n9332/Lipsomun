/**
 * 세금·4대보험 요율을 한 곳에 모은 파일.
 *
 * 왜 따로 빼는가: 이 숫자들은 해마다 바뀐다. 계산기 컴포넌트 안에 흩어져 있으면
 * 연초마다 여러 파일을 뒤져야 하고 하나를 빼먹으면 결과가 조용히 틀린다.
 * 요율이 바뀌면 이 파일 하나만 고치면 된다.
 *
 * ⚠️ 갱신 시점: 매년 1월(보험요율·세율), 매년 7월(국민연금 기준소득월액 상·하한).
 */

export const RATE_YEAR = 2026;

/** 근로자 본인 부담분만. 사업주 부담은 실수령액과 무관해서 넣지 않는다. */
export const INSURANCE = {
  /** 국민연금 4.5% (사업주와 절반씩 9%를 나눔) */
  pension: 0.045,
  /** 기준소득월액 상한 — 이 금액을 넘는 소득에는 더 붙지 않는다 */
  pensionCapMonthly: 6_170_000,
  pensionFloorMonthly: 400_000,
  /** 건강보험 3.545% (근로자 부담분) */
  health: 0.03545,
  /** 장기요양보험은 소득이 아니라 '건강보험료'에 곱한다 — 자주 틀리는 부분 */
  longTermCareOnHealth: 0.1295,
  /** 고용보험 실업급여분 0.9% */
  employment: 0.009,
};

/** 종합소득세 기본세율 — 퇴직소득세도 이 표를 쓴다 */
export const INCOME_TAX_BRACKETS: { upto: number; rate: number; deduct: number }[] = [
  { upto: 14_000_000, rate: 0.06, deduct: 0 },
  { upto: 50_000_000, rate: 0.15, deduct: 1_260_000 },
  { upto: 88_000_000, rate: 0.24, deduct: 5_760_000 },
  { upto: 150_000_000, rate: 0.35, deduct: 15_440_000 },
  { upto: 300_000_000, rate: 0.38, deduct: 19_940_000 },
  { upto: 500_000_000, rate: 0.40, deduct: 25_940_000 },
  { upto: 1_000_000_000, rate: 0.42, deduct: 35_940_000 },
  { upto: Infinity, rate: 0.45, deduct: 65_940_000 },
];

export function progressiveTax(base: number) {
  if (base <= 0) return 0;
  const b = INCOME_TAX_BRACKETS.find((x) => base <= x.upto)!;
  return Math.max(0, base * b.rate - b.deduct);
}

/** 근로소득공제 (한도 2,000만원) */
export function earnedIncomeDeduction(gross: number) {
  let d: number;
  if (gross <= 5_000_000) d = gross * 0.7;
  else if (gross <= 15_000_000) d = 3_500_000 + (gross - 5_000_000) * 0.4;
  else if (gross <= 45_000_000) d = 7_500_000 + (gross - 15_000_000) * 0.15;
  else if (gross <= 100_000_000) d = 12_000_000 + (gross - 45_000_000) * 0.05;
  else d = 14_750_000 + (gross - 100_000_000) * 0.02;
  return Math.min(d, 20_000_000);
}

/** 근로소득세액공제 — 산출세액을 깎아주되 총급여가 높을수록 한도가 줄어든다 */
export function earnedIncomeTaxCredit(calculatedTax: number, gross: number) {
  const raw =
    calculatedTax <= 1_300_000
      ? calculatedTax * 0.55
      : 715_000 + (calculatedTax - 1_300_000) * 0.3;

  let cap: number;
  if (gross <= 33_000_000) cap = 740_000;
  else if (gross <= 70_000_000)
    cap = Math.max(660_000, 740_000 - (gross - 33_000_000) * 0.008);
  else if (gross <= 120_000_000)
    cap = Math.max(500_000, 660_000 - (gross - 70_000_000) * 0.5);
  else cap = Math.max(200_000, 500_000 - (gross - 120_000_000) * 0.5);

  return Math.min(raw, cap);
}

/** 자녀세액공제 (8세 이상 20세 이하) */
export function childTaxCredit(children: number) {
  if (children <= 0) return 0;
  if (children === 1) return 250_000;
  if (children === 2) return 550_000;
  return 550_000 + (children - 2) * 300_000;
}

/** 퇴직소득세 — 근속연수공제 */
export function serviceYearDeduction(years: number) {
  const y = Math.max(1, years);
  if (y <= 5) return 1_000_000 * y;
  if (y <= 10) return 5_000_000 + 2_000_000 * (y - 5);
  if (y <= 20) return 15_000_000 + 2_500_000 * (y - 10);
  return 40_000_000 + 3_000_000 * (y - 20);
}

/** 퇴직소득세 — 환산급여공제 */
export function convertedIncomeDeduction(converted: number) {
  if (converted <= 0) return 0;
  if (converted <= 8_000_000) return converted;
  if (converted <= 70_000_000) return 8_000_000 + (converted - 8_000_000) * 0.6;
  if (converted <= 100_000_000) return 45_200_000 + (converted - 70_000_000) * 0.55;
  if (converted <= 300_000_000) return 61_700_000 + (converted - 100_000_000) * 0.45;
  return 151_700_000 + (converted - 300_000_000) * 0.35;
}

/** 지방소득세는 항상 소득세의 10% */
export const LOCAL_TAX_RATE = 0.1;

export const won = (n: number) =>
  Math.round(n).toLocaleString("ko-KR") + "원";

/* ---------- 최저임금 · 실업급여 · 통상임금 ---------- */

/** 매년 8월 고시, 다음 해 1월 적용. 갱신 시점 주의. */
export const MIN_WAGE_HOURLY = 10_320; // 2026년

/**
 * 통상임금 계산의 월 소정근로시간.
 * 주 40시간 + 주휴 8시간 = 주 48시간 × (365/7/12) ≈ 209시간.
 * 이 숫자는 법이 바뀌지 않는 한 그대로다.
 */
export const MONTHLY_WORK_HOURS = 209;

/** 구직급여(실업급여) */
export const UNEMPLOYMENT = {
  /** 평균임금의 60% */
  rate: 0.6,
  /** 1일 상한액 — 2019년부터 66,000원으로 묶여 있다 */
  dailyCap: 66_000,
  /** 1일 하한액 = 최저임금 × 80% × 1일 소정근로 8시간 */
  dailyFloor: Math.round(MIN_WAGE_HOURLY * 0.8 * 8),
};

/**
 * 소정급여일수 — 나이와 고용보험 가입기간으로 정해진다 (2019.10 개정 기준).
 * 만 50세 이상과 장애인은 한 칸씩 더 받는다.
 */
export function unemploymentDays(years: number, isOver50: boolean) {
  const under50 = [120, 150, 180, 210, 240];
  const over50 = [120, 180, 210, 240, 270];
  const i =
    years < 1 ? 0 : years < 3 ? 1 : years < 5 ? 2 : years < 10 ? 3 : 4;
  return (isOver50 ? over50 : under50)[i];
}

/**
 * 연차 발생일수 (근로기준법 제60조).
 * 1년 미만은 1개월 개근마다 1일씩 최대 11일,
 * 1년부터 15일, 3년째부터 2년마다 1일씩 붙어 25일에서 멈춘다.
 */
export function annualLeaveDays(months: number) {
  if (months < 12) return Math.min(11, Math.floor(months));
  const years = Math.floor(months / 12);
  const extra = Math.floor((years - 1) / 2);
  return Math.min(25, 15 + extra);
}
