"use client";

import { useMemo, useState } from "react";
import {
  earnedIncomeDeduction,
  earnedIncomeTaxCredit,
  childTaxCredit,
  progressiveTax,
  pensionCreditRate,
  PENSION_CREDIT,
  INSURANCE,
  LOCAL_TAX_RATE,
  won,
} from "@/lib/taxRates";

/**
 * 연말정산 환급금 계산기.
 *
 * "얼마 돌려받나요"의 답은 총급여가 아니라 과세표준에서 나온다.
 * 원천징수는 간이세액표로 미리 걷어둔 금액이고, 연말정산은 실제 공제를 반영해
 * 다시 계산한 금액이다 — 그 차이가 환급(또는 추가납부)이다.
 * 기납부세액은 사용자가 원천징수영수증/급여명세서에서 직접 가져와야 한다
 * (매달 걷힌 금액이라 역산이 어렵다).
 */

const CREDIT_CARD_BASE_RATE = 0.15; // 총급여 25% 초과분에 대한 신용카드 공제율(단순화)

function creditCardDeductionCap(grossWon: number) {
  if (grossWon <= 70_000_000) return 3_000_000;
  if (grossWon <= 120_000_000) return 2_500_000;
  return 2_000_000;
}

export default function YearEndTaxCalc() {
  const [gross, setGross] = useState(5000); // 만원, 연 총급여
  const [paidTax, setPaidTax] = useState(150); // 만원, 기납부세액(소득세+지방소득세 합)
  const [dependents, setDependents] = useState(1); // 본인 포함 부양가족 수
  const [children, setChildren] = useState(0); // 8~20세 자녀 수
  const [creditCard, setCreditCard] = useState(1500); // 만원, 연 신용카드 등 사용액
  const [pensionIrp, setPensionIrp] = useState(300); // 만원, 연금저축+IRP 합산 납입액

  const r = useMemo(() => {
    const grossWon = Math.max(0, gross) * 10_000;
    const paidTaxWon = Math.max(0, paidTax) * 10_000;
    const dep = Math.max(1, dependents);
    const kids = Math.max(0, Math.min(dep, children));
    const cardWon = Math.max(0, creditCard) * 10_000;
    const pensionWon = Math.max(0, pensionIrp) * 10_000;

    // 1. 근로소득금액
    const earnedDeduction = earnedIncomeDeduction(grossWon);
    const earnedIncome = Math.max(0, grossWon - earnedDeduction);

    // 2. 소득공제
    const personalDeduction = dep * 1_500_000;

    const pension = Math.min(grossWon, 617 * 10_000 * 12) * INSURANCE.pension;
    const health = grossWon * INSURANCE.health;
    const ltc = health * INSURANCE.longTermCareOnHealth;
    const employment = grossWon * INSURANCE.employment;
    const insuranceDeduction = pension + health + ltc + employment;

    const cardThreshold = grossWon * 0.25;
    const cardOverThreshold = Math.max(0, cardWon - cardThreshold);
    const cardDeductionRaw = cardOverThreshold * CREDIT_CARD_BASE_RATE;
    const cardDeduction = Math.min(cardDeductionRaw, creditCardDeductionCap(grossWon));

    const totalDeduction = personalDeduction + insuranceDeduction + cardDeduction;

    // 3. 과세표준 · 산출세액
    const taxBase = Math.max(0, earnedIncome - totalDeduction);
    const calculatedTax = progressiveTax(taxBase);

    // 4. 세액공제
    const earnedCredit = earnedIncomeTaxCredit(calculatedTax, grossWon);
    const childCredit = childTaxCredit(kids);
    const pensionEligible = Math.min(pensionWon, PENSION_CREDIT.totalCap);
    const pensionCreditWon = pensionEligible * pensionCreditRate(grossWon);
    const totalCredit = earnedCredit + childCredit + pensionCreditWon;

    // 5. 결정세액 (지방소득세 10% 포함)
    const decidedIncomeTax = Math.max(0, calculatedTax - totalCredit);
    const decidedTotalTax = decidedIncomeTax * (1 + LOCAL_TAX_RATE);

    const refund = paidTaxWon - decidedTotalTax;

    return {
      earnedDeduction, earnedIncome,
      personalDeduction, insuranceDeduction, cardDeduction, cardThreshold,
      totalDeduction, taxBase, calculatedTax,
      earnedCredit, childCredit, pensionCreditWon, totalCredit,
      decidedIncomeTax, decidedTotalTax,
      refund, isRefund: refund >= 0,
      cardHitCap: cardDeductionRaw > creditCardDeductionCap(grossWon),
    };
  }, [gross, paidTax, dependents, children, creditCard, pensionIrp]);

  return (
    <div className="calc">
      <div className="calc-grid">
        <Field label="연 총급여" unit="만원">
          <input
            type="number" value={gross} min={0} step={100}
            onChange={(e) => setGross(+e.target.value)}
          />
        </Field>
        <Field label="기납부세액 (연)" unit="만원">
          <input
            type="number" value={paidTax} min={0} step={10}
            onChange={(e) => setPaidTax(+e.target.value)}
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
        <Field label="신용카드 등 사용액 (연)" unit="만원">
          <input
            type="number" value={creditCard} min={0} step={100}
            onChange={(e) => setCreditCard(+e.target.value)}
          />
        </Field>
        <Field label="연금저축+IRP 납입액 (연)" unit="만원">
          <input
            type="number" value={pensionIrp} min={0} step={10}
            onChange={(e) => setPensionIrp(+e.target.value)}
          />
        </Field>
      </div>

      <div className={`calc-result ${r.isRefund ? "ok" : "no"}`}>
        <div className="calc-verdict">
          {r.isRefund ? "돌려받는 금액 (환급)" : "더 내야 하는 금액 (추가납부)"}
        </div>
        <div className="calc-net">{won(Math.abs(r.refund))}</div>
        <div className="calc-netsub">
          기납부세액 {won(Math.max(0, paidTax) * 10_000)} − 결정세액 {won(r.decidedTotalTax)}
        </div>
      </div>

      <table className="calc-table">
        <tbody>
          <tr>
            <th>근로소득금액</th>
            <td>{won(r.earnedIncome)} <span className="calc-note">(근로소득공제 {won(r.earnedDeduction)} 차감)</span></td>
          </tr>
          <tr>
            <th>인적공제</th>
            <td>{won(r.personalDeduction)}</td>
          </tr>
          <tr>
            <th>4대보험료 공제</th>
            <td>{won(r.insuranceDeduction)}</td>
          </tr>
          <tr>
            <th>신용카드 등 공제</th>
            <td>
              {won(r.cardDeduction)}
              {r.cardHitCap && <span className="calc-note"> (한도 도달)</span>}
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
            <th>세액공제 합계</th>
            <td>
              {won(r.totalCredit)}
              <span className="calc-note">
                {" "}(근로소득 {won(r.earnedCredit)} · 자녀 {won(r.childCredit)} · 연금계좌 {won(r.pensionCreditWon)})
              </span>
            </td>
          </tr>
          <tr className="calc-sum">
            <th>결정세액 (지방소득세 포함)</th>
            <td>{won(r.decidedTotalTax)}</td>
          </tr>
        </tbody>
      </table>

      {r.cardThreshold > 0 && creditCard * 10_000 <= r.cardThreshold && (
        <p className="calc-hint">
          💡 신용카드는 <b>총급여의 25%를 넘게 쓴 부분</b>부터 공제됩니다. 지금 입력한
          금액은 그 문턱({won(r.cardThreshold)})을 넘지 못해 공제가 0원입니다.
          체크카드·현금영수증은 문턱을 넘긴 뒤부터 공제율이 30%로 신용카드(15%)보다
          높으니, 문턱까지는 신용카드로 채우고 그 이후는 체크카드로 넘어가는 쪽이
          유리합니다.
        </p>
      )}
      {r.cardHitCap && (
        <p className="calc-hint">
          💡 신용카드 등 공제가 <b>한도에 도달</b>했습니다. 총급여 구간에 따라
          한도가 200만~300만원으로 정해져 있어, 이 이상 더 써도 공제액이 늘지
          않습니다.
        </p>
      )}
      {!r.isRefund && (
        <p className="calc-hint">
          ⚠️ 추가로 내야 하는 금액이 나왔습니다. 매달 걷힌 원천징수세액이 실제
          결정세액보다 적었다는 뜻입니다. 연금저축·IRP 납입을 늘리거나 신용카드
          사용을 체크카드·현금영수증으로 옮기면 다음 해 정산에서 이 차이를
          줄일 수 있습니다.
        </p>
      )}

      <p className="calc-disclaimer">
        이 계산은 인적공제·4대보험료공제·신용카드등공제·연금계좌세액공제·자녀세액공제만
        반영한 단순화된 값입니다. 의료비·교육비·기부금·월세·주택자금 공제 등은
        포함하지 않았으며, 실제 원천징수영수증(연말정산 간소화 서비스)의 금액과
        다를 수 있습니다. 4대보험료는 국민연금 상한(월 617만원 기준소득월액)만
        반영한 추정치입니다. 기납부세액은 매달 원천징수된 금액의 합계로,
        급여명세서 또는 국세청 홈택스에서 확인해 직접 입력해야 합니다.
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
