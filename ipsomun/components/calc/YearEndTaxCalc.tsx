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
  STANDARD_TAX_CREDIT_EARNED,
  insurancePremiumCredit,
  medicalExpenseCredit,
  educationCredit,
  donationCredit,
  rentCredit,
  won,
} from "@/lib/taxRates";
import Field from "./Field";

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

/** 기본 한도 — 2023 귀속부터 7천만원 초과는 250만원 한 구간으로 통합됐다 */
function creditCardDeductionCap(grossWon: number) {
  return grossWon <= 70_000_000 ? 3_000_000 : 2_500_000;
}

export default function YearEndTaxCalc() {
  const [gross, setGross] = useState(5000); // 만원, 연 총급여
  // 기본값: 총급여 5천만원·부양가족 1명의 간이세액표 원천징수 연간 합계 근사치
  const [paidTax, setPaidTax] = useState(260); // 만원, 기납부세액(소득세+지방소득세 합)
  const [dependents, setDependents] = useState(1); // 본인 포함 부양가족 수
  const [children, setChildren] = useState(0); // 8~20세 자녀 수
  const [creditCard, setCreditCard] = useState(1500); // 만원, 연 신용카드 등 사용액
  const [pensionIrp, setPensionIrp] = useState(300); // 만원, 연금저축+IRP 합산 납입액
  // 추가 공제 (만원, 해당 없으면 0)
  const [insPremium, setInsPremium] = useState(0); // 보장성보험료
  const [medical, setMedical] = useState(0); // 의료비
  const [education, setEducation] = useState(0); // 교육비 (공제대상 금액)
  const [donation, setDonation] = useState(0); // 기부금
  const [rent, setRent] = useState(0); // 월세 (무주택 세대주)
  const [showMore, setShowMore] = useState(false);

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

    const pension = Math.min(grossWon, INSURANCE.pensionCapMonthly * 12) * INSURANCE.pension;
    const health = grossWon * INSURANCE.health;
    const ltc = health * INSURANCE.longTermCareOnHealth;
    const employment = grossWon * INSURANCE.employment;
    const insuranceDeduction = pension + health + ltc + employment;

    const cardThreshold = grossWon * 0.25;
    const cardOverThreshold = Math.max(0, cardWon - cardThreshold);
    const cardDeductionRaw = cardOverThreshold * CREDIT_CARD_BASE_RATE;
    const cardDeduction = Math.min(cardDeductionRaw, creditCardDeductionCap(grossWon));

    const childCredit = childTaxCredit(kids);
    const pensionEligible = Math.min(pensionWon, PENSION_CREDIT.totalCap);
    // pensionCreditRate 는 지방소득세까지 포함한 환급률(16.5%/13.2%)이다. 여기서는 소득세 세액공제만
    // 필요하므로(지방소득세는 맨 끝에서 결정세액에 10%를 붙인다) 1.1 로 나눠 15%/12% 로 쓴다.
    const pensionCreditWon = Math.round((pensionEligible * pensionCreditRate(grossWon)) / (1 + LOCAL_TAX_RATE));

    // 특별세액공제(보험료·의료비·교육비·기부금) + 월세세액공제
    const man = (v: number) => Math.max(0, v) * 10_000;
    const specialCredits = {
      insurance: insurancePremiumCredit(man(insPremium)),
      medical: medicalExpenseCredit(man(medical), grossWon),
      education: educationCredit(man(education)),
      donation: donationCredit(man(donation)),
      rent: rentCredit(man(rent), grossWon),
    };
    const specialCreditSum = Object.values(specialCredits).reduce((a, b) => a + b, 0);

    // 3~4. 과세표준 · 산출세액 · 세액공제
    // 건강·고용보험료 공제(특별소득공제), 보험료·의료비·교육비·기부금(특별세액공제), 월세세액공제를
    // 모두 포기하면 표준세액공제 13만원을 대신 받을 수 있다. 둘 중 세금이 적은 쪽이 실제 결과다.
    const settle = (deduction: number, extraCredit: number) => {
      const taxBase = Math.max(0, earnedIncome - deduction);
      const calculatedTax = progressiveTax(taxBase);
      const earnedCredit = earnedIncomeTaxCredit(calculatedTax, grossWon);
      const totalCredit = earnedCredit + childCredit + pensionCreditWon + extraCredit;
      return {
        taxBase, calculatedTax, earnedCredit, totalCredit,
        decided: Math.max(0, calculatedTax - totalCredit),
      };
    };
    const special = settle(personalDeduction + insuranceDeduction + cardDeduction, specialCreditSum);
    const standard = settle(
      personalDeduction + pension + cardDeduction,
      STANDARD_TAX_CREDIT_EARNED,
    );
    const useStandard = standard.decided < special.decided;
    const best = useStandard ? standard : special;
    const { taxBase, calculatedTax, earnedCredit, totalCredit } = best;
    const totalDeduction =
      personalDeduction + (useStandard ? pension : insuranceDeduction) + cardDeduction;

    // 5. 결정세액 (지방소득세 10% 포함)
    const decidedIncomeTax = best.decided;
    const decidedTotalTax = decidedIncomeTax * (1 + LOCAL_TAX_RATE);

    const refund = paidTaxWon - decidedTotalTax;

    return {
      earnedDeduction, earnedIncome,
      personalDeduction, cardDeduction, cardThreshold,
      totalDeduction, taxBase, calculatedTax,
      earnedCredit, childCredit, pensionCreditWon, totalCredit, useStandard,
      specialCredits, specialCreditSum,
      insuranceDeduction: useStandard ? pension : insuranceDeduction,
      decidedIncomeTax, decidedTotalTax,
      refund, isRefund: refund >= 0,
      cardHitCap: cardDeductionRaw > creditCardDeductionCap(grossWon),
    };
  }, [gross, paidTax, dependents, children, creditCard, pensionIrp, insPremium, medical, education, donation, rent]);

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

      <button type="button" className="calc-more-toggle" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
        {showMore ? "▲ 추가 공제 닫기" : "▼ 의료비·교육비·월세·기부금·보험료도 넣기"}
      </button>
      {showMore && (
        <div className="calc-grid">
          <Field label="보장성보험료 (연, 한도 100만)" unit="만원">
            <input type="number" value={insPremium} min={0} step={10} onChange={(e) => setInsPremium(+e.target.value)} />
          </Field>
          <Field label="의료비 (연, 가족 합산)" unit="만원">
            <input type="number" value={medical} min={0} step={10} onChange={(e) => setMedical(+e.target.value)} />
          </Field>
          <Field label="교육비 (공제대상 금액)" unit="만원">
            <input type="number" value={education} min={0} step={10} onChange={(e) => setEducation(+e.target.value)} />
          </Field>
          <Field label="기부금 (연)" unit="만원">
            <input type="number" value={donation} min={0} step={10} onChange={(e) => setDonation(+e.target.value)} />
          </Field>
          <Field label="월세 (연, 무주택 세대주)" unit="만원">
            <input type="number" value={rent} min={0} step={10} onChange={(e) => setRent(+e.target.value)} />
          </Field>
        </div>
      )}

      <div aria-live="polite" className={`calc-result ${r.isRefund ? "ok" : "no"}`}>
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
            <td>
              {won(r.insuranceDeduction)}
              {r.useStandard && (
                <span className="calc-note"> (국민연금만 — 표준세액공제가 더 유리)</span>
              )}
            </td>
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
                {" "}(근로소득 {won(r.earnedCredit)} · 자녀 {won(r.childCredit)} · 연금계좌 {won(r.pensionCreditWon)}
                {r.useStandard ? " · 표준 130,000원" : r.specialCreditSum > 0 ? ` · 의료비 등 ${won(r.specialCreditSum)}` : ""})
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
          한도가 250만~300만원으로 정해져 있어, 이 이상 더 써도 공제액이 늘지
          않습니다.
        </p>
      )}
      {r.useStandard && r.specialCreditSum > 0 && (
        <p className="calc-hint">
          💡 입력한 의료비·교육비 등의 공제({won(r.specialCreditSum)})보다 <b>표준세액공제 13만원</b>이 더
          유리해서 표준세액공제로 계산했습니다. 둘은 함께 받을 수 없습니다.
        </p>
      )}
      {medical > 0 && r.specialCredits.medical === 0 && (
        <p className="calc-hint">
          💡 의료비는 <b>총급여의 3%({won(Math.max(0, gross) * 300)})를 넘게 쓴 부분</b>부터 공제됩니다.
          맞벌이라면 소득이 적은 배우자 쪽으로 몰아야 문턱을 넘기 쉽습니다.
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
        이 계산은 인적공제·4대보험료·신용카드등·연금계좌·자녀·보장성보험료·의료비·교육비·기부금·월세
        공제를 반영한 단순화된 값입니다. 주택자금·청약저축 공제, 의료비 한도 예외(본인·65세 이상·장애인),
        체크카드·전통시장 공제율 차이 등은 반영하지 않아 실제 원천징수영수증(연말정산 간소화 서비스)의
        금액과 다를 수 있습니다. 4대보험료는 국민연금 기준소득월액 상한만 반영한
        추정치이며, 특별소득공제와 표준세액공제(13만원) 중 유리한 쪽을 자동으로 고릅니다. 기납부세액은 매달 원천징수된 금액의 합계로,
        급여명세서 또는 국세청 홈택스에서 확인해 직접 입력해야 합니다.
      </p>
    </div>
  );
}
