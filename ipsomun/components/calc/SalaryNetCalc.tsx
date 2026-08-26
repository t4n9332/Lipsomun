"use client";

import { useMemo, useState } from "react";
import {
  INSURANCE,
  RATE_YEAR,
  progressiveTax,
  earnedIncomeDeduction,
  earnedIncomeTaxCredit,
  childTaxCredit,
  LOCAL_TAX_RATE,
  won,
} from "@/lib/taxRates";

/**
 * 연봉 실수령액 계산기.
 *
 * 사람들이 검색하는 이유는 하나다 — "연봉 5천이면 통장에 얼마 꽂히나".
 * 시중 표는 부양가족 1명·비과세 20만원으로 고정돼 있어서 본인 상황과 안 맞는다.
 * 여기서는 그 두 개를 직접 바꿀 수 있게 했다. 그게 이 계산기의 존재 이유다.
 *
 * 소득세는 간이세액표가 아니라 연말정산 방식으로 계산한다.
 * 매달 떼는 돈은 간이세액표를 따르지만 그건 어차피 2월에 정산돼 돌아온다.
 * 1년 기준으로 실제 내가 내는 세금은 이쪽이 맞다.
 */

export default function SalaryNetCalc() {
  const [annual, setAnnual] = useState(5000); // 만원
  const [taxFreeMonthly, setTaxFreeMonthly] = useState(20); // 만원 (식대 등)
  const [family, setFamily] = useState(1); // 본인 포함 부양가족
  const [children, setChildren] = useState(0); // 8~20세 자녀

  const r = useMemo(() => {
    const annualWon = annual * 10_000;
    const taxFree = Math.max(0, taxFreeMonthly) * 10_000;
    const monthly = annualWon / 12;

    // ① 4대보험 — 비과세를 뺀 과세 급여에 붙는다
    const taxableMonthly = Math.max(0, monthly - taxFree);

    const pensionBase = Math.min(
      Math.max(taxableMonthly, INSURANCE.pensionFloorMonthly),
      INSURANCE.pensionCapMonthly
    );
    const pension = taxableMonthly > 0 ? pensionBase * INSURANCE.pension : 0;
    const health = taxableMonthly * INSURANCE.health;
    const care = health * INSURANCE.longTermCareOnHealth;
    const employment = taxableMonthly * INSURANCE.employment;
    const insuranceMonthly = pension + health + care + employment;

    // ② 소득세 — 연 단위로 구한 뒤 12로 나눈다
    const gross = Math.max(0, annualWon - taxFree * 12); // 총급여(비과세 제외)
    const incomeAmount = gross - earnedIncomeDeduction(gross); // 근로소득금액
    const personal = 1_500_000 * Math.max(1, family); // 인적공제
    const insuranceYear = insuranceMonthly * 12;

    const base = Math.max(0, incomeAmount - personal - insuranceYear);
    const calculated = progressiveTax(base);
    const credit =
      earnedIncomeTaxCredit(calculated, gross) + childTaxCredit(children);
    const incomeTaxYear = Math.max(0, calculated - credit);
    const localTaxYear = incomeTaxYear * LOCAL_TAX_RATE;

    const incomeTax = incomeTaxYear / 12;
    const localTax = localTaxYear / 12;

    const totalDeduct = insuranceMonthly + incomeTax + localTax;
    const net = monthly - totalDeduct;

    return {
      monthly, net, totalDeduct,
      pension, health, care, employment, insuranceMonthly,
      incomeTax, localTax,
      netYear: net * 12,
      rate: monthly > 0 ? (totalDeduct / monthly) * 100 : 0,
      capped: taxableMonthly > INSURANCE.pensionCapMonthly,
    };
  }, [annual, taxFreeMonthly, family, children]);

  return (
    <div className="calc">
      <div className="calc-grid">
        <Field label="연봉 (세전)" unit="만원">
          <input
            type="number" value={annual} min={0} step={100}
            onChange={(e) => setAnnual(+e.target.value)}
          />
        </Field>
        <Field label="월 비과세액" unit="만원">
          <input
            type="number" value={taxFreeMonthly} min={0} max={200} step={1}
            onChange={(e) => setTaxFreeMonthly(+e.target.value)}
          />
        </Field>
        <Field label="부양가족 (본인 포함)" unit="명">
          <input
            type="number" value={family} min={1} max={10} step={1}
            onChange={(e) => setFamily(+e.target.value)}
          />
        </Field>
        <Field label="자녀 (8~20세)" unit="명">
          <input
            type="number" value={children} min={0} max={10} step={1}
            onChange={(e) => setChildren(+e.target.value)}
          />
        </Field>
      </div>

      <div className="calc-result ok">
        <div className="calc-verdict">매달 통장에 들어오는 금액</div>
        <div className="calc-net">{won(r.net)}</div>
        <div className="calc-netsub">
          연 {won(r.netYear)} · 공제율 {r.rate.toFixed(1)}%
        </div>
      </div>

      <table className="calc-table">
        <tbody>
          <tr>
            <th>세전 월급</th>
            <td>{won(r.monthly)}</td>
          </tr>
          <tr>
            <th>국민연금</th>
            <td>
              −{won(r.pension)}
              {r.capped && <span className="calc-note"> (상한 적용)</span>}
            </td>
          </tr>
          <tr>
            <th>건강보험</th>
            <td>−{won(r.health)}</td>
          </tr>
          <tr>
            <th>장기요양보험</th>
            <td>
              −{won(r.care)}
              <span className="calc-note"> (건강보험료의 12.95%)</span>
            </td>
          </tr>
          <tr>
            <th>고용보험</th>
            <td>−{won(r.employment)}</td>
          </tr>
          <tr>
            <th>소득세</th>
            <td>−{won(r.incomeTax)}</td>
          </tr>
          <tr>
            <th>지방소득세</th>
            <td>−{won(r.localTax)}</td>
          </tr>
          <tr className="calc-sum">
            <th>실수령액</th>
            <td>{won(r.net)}</td>
          </tr>
        </tbody>
      </table>

      {taxFreeMonthly < 20 && (
        <p className="calc-hint">
          💡 식대는 월 <b>20만원</b>까지 비과세입니다. 급여명세서에 식대 항목이 있는데
          여기에 0을 넣으셨다면 실수령액이 실제보다 낮게 나옵니다.
        </p>
      )}
      {r.capped && (
        <p className="calc-hint">
          💡 국민연금은 월 소득 <b>617만원</b>까지만 부과됩니다. 이 위로는 연봉이
          올라도 연금 보험료가 더 늘지 않아 공제율이 오히려 떨어집니다.
        </p>
      )}

      <p className="calc-disclaimer">
        {RATE_YEAR}년 요율 기준이며, 소득세는 연말정산 방식(근로소득공제·인적공제·
        보험료공제·근로소득세액공제 반영)으로 계산한 <b>1년 평균</b>입니다.
        매달 급여에서 떼는 금액은 간이세액표를 따르므로 이 숫자와 다를 수 있고,
        그 차액은 이듬해 2월 연말정산에서 돌려받거나 더 냅니다.
        의료비·신용카드·연금저축 등 개인별 공제는 반영하지 않았으므로
        실제 실수령액은 이 값보다 높아지는 경우가 많습니다.
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
        <em>{unit}</em>
      </span>
    </label>
  );
}
