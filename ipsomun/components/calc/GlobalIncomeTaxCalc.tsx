"use client";

import { useMemo, useState } from "react";
import {
  progressiveTax,
  childTaxCredit,
  noranUmbrellaCap,
  WITHHOLDING_FREELANCE,
  STANDARD_TAX_CREDIT_NO_EARNED,
  SIMPLE_EXPENSE_LIMIT_SERVICE,
  BASIC_DEDUCTION_PER_PERSON,
  LOCAL_TAX_RATE,
  won,
} from "@/lib/taxRates";

/**
 * 종합소득세 계산기 — 프리랜서(3.3% 원천징수) 기준.
 *
 * 이 계산기가 답해야 하는 질문은 하나다: "3.3% 떼인 것 중 얼마 돌려받나."
 * 연말정산 계산기와 결정적으로 다른 점은 **기납부세액을 사용자가 찾아올 필요가 없다**는 것.
 * 프리랜서는 총수입의 정확히 3.3%가 원천징수되므로 총수입만 넣으면 자동으로 나온다.
 *
 * 근로소득이 함께 있는 사람(투잡)에게는 맞지 않는다 — 근로소득공제·근로소득세액공제가
 * 따로 붙고 표준세액공제 금액도 달라진다. 그건 억지로 넣는 대신 안내로 끊는다.
 */

/** 인적용역(940909) 단순경비율로 흔히 쓰이는 값. 업종·연도마다 달라서 입력값으로 둔다. */
const DEFAULT_EXPENSE_RATE = 64.1;

export default function GlobalIncomeTaxCalc() {
  // 기본값은 단순경비율 한도(2,400만원) 아래로 둔다 — 열자마자 경고가 뜨면 안 된다
  const [revenue, setRevenue] = useState(2000); // 만원, 연 총수입금액(3.3% 떼기 전)
  const [useSimpleRate, setUseSimpleRate] = useState(true);
  const [expenseRate, setExpenseRate] = useState(DEFAULT_EXPENSE_RATE); // %
  const [expenseAmount, setExpenseAmount] = useState(0); // 만원, 장부 작성 시 실제 경비
  const [dependents, setDependents] = useState(1); // 본인 포함
  const [children, setChildren] = useState(0); // 8~20세
  const [nationalPension, setNationalPension] = useState(0); // 만원, 지역가입자 연금보험료
  const [noran, setNoran] = useState(0); // 만원, 노란우산공제 납입액

  const r = useMemo(() => {
    const revenueWon = Math.max(0, revenue) * 10_000;
    const dep = Math.max(1, dependents);
    const kids = Math.max(0, Math.min(dep, children));
    const pensionWon = Math.max(0, nationalPension) * 10_000;
    const noranWon = Math.max(0, noran) * 10_000;

    // 1. 필요경비 — 단순경비율 또는 장부상 실제 경비
    const rate = Math.min(100, Math.max(0, expenseRate)) / 100;
    const expenses = useSimpleRate
      ? revenueWon * rate
      : Math.min(revenueWon, Math.max(0, expenseAmount) * 10_000);

    // 2. 사업소득금액
    const businessIncome = Math.max(0, revenueWon - expenses);

    // 3. 소득공제
    const basicDeduction = dep * BASIC_DEDUCTION_PER_PERSON;
    const noranCap = noranUmbrellaCap(businessIncome);
    const noranDeduction = Math.min(noranWon, noranCap);
    const totalDeduction = basicDeduction + pensionWon + noranDeduction;

    // 4. 과세표준 · 산출세액
    const taxBase = Math.max(0, businessIncome - totalDeduction);
    const calculatedTax = progressiveTax(taxBase);

    // 5. 세액공제
    const childCredit = childTaxCredit(kids);
    const standardCredit = STANDARD_TAX_CREDIT_NO_EARNED;
    const totalCredit = childCredit + standardCredit;

    // 6. 결정세액 + 지방소득세
    const decidedIncomeTax = Math.max(0, calculatedTax - totalCredit);
    const localTax = decidedIncomeTax * LOCAL_TAX_RATE;
    const decidedTotalTax = decidedIncomeTax + localTax;

    // 7. 기납부세액 — 프리랜서는 총수입의 3.3%가 이미 나갔다
    const withheld = revenueWon * WITHHOLDING_FREELANCE;
    const refund = withheld - decidedTotalTax;

    return {
      expenses, businessIncome,
      basicDeduction, noranDeduction, noranCap, totalDeduction,
      taxBase, calculatedTax,
      childCredit, standardCredit, totalCredit,
      decidedIncomeTax, localTax, decidedTotalTax,
      withheld, refund, isRefund: refund >= 0,
      effectiveRate: revenueWon > 0 ? (decidedTotalTax / revenueWon) * 100 : 0,
      // 단순경비율은 '2,400만원 미만'이 대상이다. 딱 2,400만원이면 이미 대상이 아니다.
      overSimpleLimit: revenueWon >= SIMPLE_EXPENSE_LIMIT_SERVICE,
      noranRoom: Math.max(0, noranCap - noranDeduction),
      noranOver: noranWon > noranCap,
      zeroTax: decidedIncomeTax === 0,
    };
  }, [
    revenue, useSimpleRate, expenseRate, expenseAmount,
    dependents, children, nationalPension, noran,
  ]);

  return (
    <div className="calc">
      <div className="calc-grid">
        <Field label="연 총수입금액 (3.3% 떼기 전)" unit="만원">
          <input
            type="number" value={revenue} min={0} step={100}
            onChange={(e) => setRevenue(+e.target.value)}
          />
        </Field>
        <Field label="부양가족 수 (본인 포함)" unit="명">
          <input
            type="number" value={dependents} min={1} step={1}
            onChange={(e) => setDependents(+e.target.value)}
          />
        </Field>
        <Field label="8~20세 자녀 수" unit="명">
          <input
            type="number" value={children} min={0} step={1}
            onChange={(e) => setChildren(+e.target.value)}
          />
        </Field>
        <Field label="국민연금 납부액 (연)" unit="만원">
          <input
            type="number" value={nationalPension} min={0} step={10}
            onChange={(e) => setNationalPension(+e.target.value)}
          />
        </Field>
        <Field label="노란우산공제 납입액 (연)" unit="만원">
          <input
            type="number" value={noran} min={0} step={10}
            onChange={(e) => setNoran(+e.target.value)}
          />
        </Field>
      </div>

      {/* 경비를 어떻게 잡느냐가 세금을 가장 크게 흔든다. 그래서 따로 떼어 보여준다. */}
      <div className="calc-grid">
        <Field label="필요경비 방식" unit="">
          <select
            value={useSimpleRate ? "rate" : "book"}
            onChange={(e) => setUseSimpleRate(e.target.value === "rate")}
          >
            <option value="rate">단순경비율로 추정</option>
            <option value="book">장부상 실제 경비 입력</option>
          </select>
        </Field>
        {useSimpleRate ? (
          <Field label="단순경비율" unit="%">
            <input
              type="number" value={expenseRate} min={0} max={100} step={0.1}
              onChange={(e) => setExpenseRate(+e.target.value)}
            />
          </Field>
        ) : (
          <Field label="실제 필요경비 (연)" unit="만원">
            <input
              type="number" value={expenseAmount} min={0} step={100}
              onChange={(e) => setExpenseAmount(+e.target.value)}
            />
          </Field>
        )}
      </div>

      <div className={`calc-result ${r.isRefund ? "ok" : "no"}`}>
        <div className="calc-verdict">
          {r.isRefund ? "돌려받는 금액 (환급)" : "더 내야 하는 금액 (추가납부)"}
        </div>
        <div className="calc-net">{won(Math.abs(r.refund))}</div>
        <div className="calc-netsub">
          원천징수 {won(r.withheld)} − 결정세액 {won(r.decidedTotalTax)}
          {revenue > 0 && ` · 실효세율 ${r.effectiveRate.toFixed(1)}%`}
        </div>
      </div>

      <table className="calc-table">
        <tbody>
          <tr>
            <th>필요경비</th>
            <td>
              {won(r.expenses)}
              <span className="calc-note">
                {useSimpleRate ? ` (단순경비율 ${expenseRate}%)` : " (장부상 실제 경비)"}
              </span>
            </td>
          </tr>
          <tr>
            <th>사업소득금액</th>
            <td>{won(r.businessIncome)}</td>
          </tr>
          <tr>
            <th>기본공제</th>
            <td>{won(r.basicDeduction)} <span className="calc-note">({dependents}명 × 150만원)</span></td>
          </tr>
          <tr>
            <th>국민연금 공제</th>
            <td>{won(Math.max(0, nationalPension) * 10_000)}</td>
          </tr>
          <tr>
            <th>노란우산공제</th>
            <td>
              {won(r.noranDeduction)}
              {r.noranOver && <span className="calc-note"> (한도 {won(r.noranCap)} 초과분 제외)</span>}
            </td>
          </tr>
          <tr>
            <th>과세표준</th>
            <td>{won(r.taxBase)}</td>
          </tr>
          <tr>
            <th>산출세액</th>
            <td>{won(r.calculatedTax)}</td>
          </tr>
          <tr>
            <th>세액공제</th>
            <td>
              {won(r.totalCredit)}
              <span className="calc-note">
                {" "}(표준 {won(r.standardCredit)} · 자녀 {won(r.childCredit)})
              </span>
            </td>
          </tr>
          <tr>
            <th>지방소득세 (10%)</th>
            <td>{won(r.localTax)}</td>
          </tr>
          <tr className="calc-sum">
            <th>결정세액 합계</th>
            <td>{won(r.decidedTotalTax)}</td>
          </tr>
        </tbody>
      </table>

      {r.overSimpleLimit && useSimpleRate && (
        <p className="calc-hint">
          ⚠️ 수입금액이 <b>2,400만원</b>을 넘습니다. 서비스업·인적용역은 이 선을 넘으면
          단순경비율이 아니라 <b>기준경비율</b> 대상이 되어 경비 인정 방식이 완전히
          달라집니다(증빙이 있는 주요경비만 인정). 업종과 신규사업자 여부에 따라
          한도가 다르니, 본인이 어느 쪽인지 홈택스에서 먼저 확인하세요.
          기준경비율 대상인데 위 값을 그대로 믿으면 세금이 크게 과소 추정됩니다.
        </p>
      )}
      {r.zeroTax && (
        <p className="calc-hint">
          💡 <b>낼 세금이 0원이라 원천징수된 {won(r.withheld)}을 전액 돌려받습니다.</b>{" "}
          소득이 공제 범위 안에 들어와 결정세액이 0이 된 경우입니다. 이때는 신고를
          해야만 돌려받습니다 — 신고하지 않으면 그대로 국가에 남습니다.
        </p>
      )}
      {r.noranRoom > 0 && (
        <p className="calc-hint">
          💡 노란우산공제를 <b>{won(r.noranRoom)}</b> 더 넣을 수 있습니다.
          사업소득금액 {won(r.businessIncome)} 구간의 한도는 {won(r.noranCap)}입니다.
          프리랜서가 쓸 수 있는 소득공제 중 폭이 가장 큰 항목이고,
          폐업·퇴임 전까지 압류되지 않는다는 점도 예금과 다릅니다.
        </p>
      )}
      {!r.isRefund && (
        <p className="calc-hint">
          ⚠️ 3.3%로 떼인 금액보다 실제 세금이 더 큽니다. 소득이 올라가면 누진세율이
          3%를 넘어서기 때문에 생기는 정상적인 결과입니다. 5월 신고 때 차액을 내야 하니
          미리 준비해두세요. 노란우산공제·국민연금·장부작성으로 줄일 수 있는 여지가
          있는지 먼저 확인하는 게 순서입니다.
        </p>
      )}

      <p className="calc-disclaimer">
        <b>근로소득이 함께 있는 경우(회사원 + 프리랜서)에는 이 계산이 맞지 않습니다.</b>{" "}
        근로소득공제와 근로소득세액공제가 따로 붙고 표준세액공제 금액도 달라집니다.
        이 계산은 사업소득(3.3% 원천징수)만 있는 경우를 기준으로 하며,
        기본공제·국민연금·노란우산공제·자녀세액공제·표준세액공제만 반영한 단순화된
        값입니다. 의료비·기부금·연금저축 등은 포함하지 않았습니다. 단순경비율은 업종코드와
        귀속연도에 따라 다르고 매년 바뀌므로 홈택스에서 본인 업종의 경비율을 확인해
        입력하세요. 무기장가산세·성실신고확인 대상 여부는 반영하지 않았습니다.
        최종 세액은 홈택스 신고 화면의 값이 기준입니다.
      </p>
    </div>
  );
}

function Field({
  label, unit, children,
}: { label: string; unit: string; children: React.ReactNode }) {
  return (
    <label className="calc-field">
      <span className="calc-label">{label}</span>
      <span className="calc-input">
        {children}
        {unit && <em>{unit}</em>}
      </span>
    </label>
  );
}
