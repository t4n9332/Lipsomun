"use client";

import { useMemo, useState } from "react";
import { INSURANCE, MIN_WAGE_HOURLY, payFromHourly, won } from "@/lib/taxRates";
import Field from "./Field";

/**
 * 시급 → 주급·월급 계산기 (주휴수당 포함).
 *
 * 알바·단시간 근로자가 가장 많이 틀리는 건 '주휴수당'이다. 주 15시간만 넘으면 생기고,
 * 5인 미만 가게도 줘야 한다. 이걸 빼면 월급이 20% 가까이 적게 계산된다.
 * 실수령액은 계약 형태에 따라 공제가 달라서 세 가지 중 고르게 한다.
 */
type Deduct = "none" | "freelance" | "insurance";

export default function HourlyPayCalc() {
  const [hourly, setHourly] = useState(MIN_WAGE_HOURLY);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [deduct, setDeduct] = useState<Deduct>("none");

  const r = useMemo(() => {
    const p = payFromHourly(Math.max(0, hourly), hoursPerDay, daysPerWeek);
    let deduction = 0;
    if (deduct === "freelance") deduction = Math.round(p.monthly * 0.033);
    if (deduct === "insurance") {
      const pensionBase = Math.min(Math.max(p.monthly, INSURANCE.pensionFloorMonthly), INSURANCE.pensionCapMonthly);
      const pension = pensionBase * INSURANCE.pension;
      const health = p.monthly * INSURANCE.health;
      const ltc = health * INSURANCE.longTermCareOnHealth;
      const employment = p.monthly * INSURANCE.employment;
      deduction = Math.round(pension + health + ltc + employment);
    }
    return { ...p, deduction, net: p.monthly - deduction };
  }, [hourly, hoursPerDay, daysPerWeek, deduct]);

  return (
    <div className="calc">
      <div className="calc-grid">
        <Field label="시급" unit="원">
          <input type="number" value={hourly} min={0} step={10} onChange={(e) => setHourly(+e.target.value)} />
        </Field>
        <Field label="하루 근무시간 (휴게 제외)" unit="시간">
          <input type="number" value={hoursPerDay} min={0} max={24} step={0.5} onChange={(e) => setHoursPerDay(+e.target.value)} />
        </Field>
        <Field label="주 근무일수" unit="일">
          <input type="number" value={daysPerWeek} min={0} max={7} step={1} onChange={(e) => setDaysPerWeek(+e.target.value)} />
        </Field>
        <Field label="공제 방식" unit="">
          <select value={deduct} onChange={(e) => setDeduct(e.target.value as Deduct)}>
            <option value="none">공제 전 (세전)</option>
            <option value="freelance">3.3% 떼는 알바</option>
            <option value="insurance">4대보험 가입</option>
          </select>
        </Field>
      </div>

      <div aria-live="polite" className={`calc-result ${r.belowMinimum ? "no" : "ok"}`}>
        <div className="calc-verdict">{deduct === "none" ? "예상 월급 (주휴수당 포함)" : "예상 실수령 월급"}</div>
        <div className="calc-net">{won(deduct === "none" ? r.monthly : r.net)}</div>
        <div className="calc-netsub">
          주급 {won(r.weekly)} · 월 {r.monthlyHours}시간 기준
        </div>
      </div>

      <table className="calc-table">
        <tbody>
          <tr>
            <th>주 소정근로시간</th>
            <td>{r.weeklyHours}시간</td>
          </tr>
          <tr>
            <th>주휴수당 (주당)</th>
            <td>
              {won(r.holidayPay)}
              <span className="calc-note">
                {" "}
                {r.holidayHours > 0 ? `(${Math.round(r.holidayHours * 10) / 10}시간분)` : "(주 15시간 미만 — 없음)"}
              </span>
            </td>
          </tr>
          <tr>
            <th>월급 (세전)</th>
            <td>{won(r.monthly)}</td>
          </tr>
          {deduct !== "none" && (
            <tr>
              <th>{deduct === "freelance" ? "3.3% 원천징수" : "4대보험 (근로자 부담)"}</th>
              <td>−{won(r.deduction)}</td>
            </tr>
          )}
          {deduct !== "none" && (
            <tr className="calc-sum">
              <th>실수령</th>
              <td>{won(r.net)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {r.belowMinimum && (
        <p className="calc-hint">
          ⚠️ 입력한 시급이 <b>2026년 최저임금 {won(MIN_WAGE_HOURLY)}</b>보다 낮습니다. 수습 3개월(1년 이상 계약)·
          감시단속직 등 예외가 아니라면 최저임금법 위반입니다. 고용노동부 고객상담센터(국번 없이 1350)에 상담할 수 있어요.
        </p>
      )}
      {r.weeklyHours >= 15 && (
        <p className="calc-hint">
          💡 주 15시간 이상 일하면 <b>주휴수당</b>이 붙습니다. 이번 주 소정근로일을 다 나왔다면 사업장 규모(5인 미만
          포함)와 상관없이 받을 수 있어요. 주휴수당을 빼고 계산하면 월급이 약 {Math.round((r.holidayHours / Math.max(1, r.weeklyHours)) * 100)}% 적게 나옵니다.
        </p>
      )}
      {r.weeklyHours > 0 && r.weeklyHours < 15 && (
        <p className="calc-hint">
          💡 주 15시간 미만이라 주휴수당·퇴직금·연차가 생기지 않습니다. 하루 30분만 늘어도 기준을 넘는지 확인해 보세요.
        </p>
      )}

      <p className="calc-disclaimer">
        월급은 법정 방식((주 소정근로 + 주휴) × 365 ÷ 7 ÷ 12 시간)으로 환산했습니다. 연장·야간·휴일 가산수당(5인 이상
        사업장 1.5배)과 소득세는 반영하지 않았습니다. 4대보험 공제는 2026년 근로자 부담 요율
        기준 추정치입니다.
      </p>
    </div>
  );
}
