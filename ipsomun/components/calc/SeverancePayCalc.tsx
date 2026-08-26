"use client";

import { useMemo, useState } from "react";
import {
  progressiveTax,
  serviceYearDeduction,
  convertedIncomeDeduction,
  LOCAL_TAX_RATE,
  won,
} from "@/lib/taxRates";

/**
 * 퇴직금 계산기.
 *
 * 회사가 알려주는 금액이 맞는지 확인하려고 검색하는 사람이 대부분이다.
 * 그래서 두 가지를 반드시 보여줘야 한다 —
 *  ① 상여금·연차수당이 평균임금에 들어간다는 것 (빠뜨리면 금액이 줄어든다)
 *  ② 세금 떼고 실제로 받는 돈 (퇴직소득세는 근속연수가 길수록 확 줄어든다)
 * 세전 금액만 보여주는 계산기는 절반만 답한 것이다.
 */

const DAY = 86_400_000;

/** 퇴사일 직전 3개월의 실제 일수 — 89~92일로 달마다 다르다 */
function daysInLast3Months(end: Date) {
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));
}

export default function SeverancePayCalc() {
  const [joinDate, setJoinDate] = useState("2021-03-02");
  const [leaveDate, setLeaveDate] = useState("2026-03-02");
  const [monthlyPay, setMonthlyPay] = useState(350); // 만원, 기본급+고정수당
  const [bonusYear, setBonusYear] = useState(0); // 만원, 최근 1년 상여금
  const [leavePayYear, setLeavePayYear] = useState(0); // 만원, 최근 1년 연차수당

  const r = useMemo(() => {
    const join = new Date(joinDate);
    const leave = new Date(leaveDate);
    const workDays = Math.round((leave.getTime() - join.getTime()) / DAY);

    if (!workDays || workDays <= 0 || isNaN(workDays)) {
      return { invalid: true as const, workDays: 0 };
    }

    const periodDays = daysInLast3Months(leave);

    // ① 평균임금 = (3개월 임금 + 상여금×3/12 + 연차수당×3/12) ÷ 3개월 총일수
    const pay3m = monthlyPay * 10_000 * 3;
    const bonus3m = (bonusYear * 10_000 * 3) / 12;
    const leave3m = (leavePayYear * 10_000 * 3) / 12;
    const totalWage = pay3m + bonus3m + leave3m;
    const dailyAvg = totalWage / periodDays;

    // ② 퇴직금 = 1일 평균임금 × 30일 × (재직일수 ÷ 365)
    const gross = dailyAvg * 30 * (workDays / 365);

    // ③ 퇴직소득세 — 근속연수는 1년 미만을 올려서 센다
    const years = Math.max(1, Math.ceil(workDays / 365));
    const afterServiceDeduct = Math.max(0, gross - serviceYearDeduction(years));
    const converted = (afterServiceDeduct / years) * 12; // 환산급여
    const taxBase = Math.max(0, converted - convertedIncomeDeduction(converted));
    const convertedTax = progressiveTax(taxBase); // 환산산출세액
    const incomeTax = (convertedTax / 12) * years;
    const localTax = incomeTax * LOCAL_TAX_RATE;
    const net = gross - incomeTax - localTax;

    return {
      invalid: false as const,
      workDays, periodDays, dailyAvg, gross, years,
      incomeTax, localTax, net,
      monthlyEquiv: dailyAvg * 30,
      tooShort: workDays < 365,
      effectiveTaxRate: gross > 0 ? ((incomeTax + localTax) / gross) * 100 : 0,
    };
  }, [joinDate, leaveDate, monthlyPay, bonusYear, leavePayYear]);

  return (
    <div className="calc">
      <div className="calc-grid">
        <Field label="입사일" unit="">
          <input
            type="date" value={joinDate}
            onChange={(e) => setJoinDate(e.target.value)}
          />
        </Field>
        <Field label="퇴사일" unit="">
          <input
            type="date" value={leaveDate}
            onChange={(e) => setLeaveDate(e.target.value)}
          />
        </Field>
        <Field label="월 급여 (기본급+고정수당)" unit="만원">
          <input
            type="number" value={monthlyPay} min={0} step={10}
            onChange={(e) => setMonthlyPay(+e.target.value)}
          />
        </Field>
        <Field label="최근 1년 상여금" unit="만원">
          <input
            type="number" value={bonusYear} min={0} step={10}
            onChange={(e) => setBonusYear(+e.target.value)}
          />
        </Field>
        <Field label="최근 1년 연차수당" unit="만원">
          <input
            type="number" value={leavePayYear} min={0} step={10}
            onChange={(e) => setLeavePayYear(+e.target.value)}
          />
        </Field>
      </div>

      {r.invalid ? (
        <div className="calc-result no">
          <div className="calc-verdict">날짜를 확인해주세요</div>
          <div className="calc-netsub">퇴사일이 입사일보다 뒤여야 합니다</div>
        </div>
      ) : r.tooShort ? (
        <div className="calc-result no">
          <div className="calc-verdict">퇴직금 지급 대상이 아닙니다</div>
          <div className="calc-net">{r.workDays}일</div>
          <div className="calc-netsub">
            1년(365일) 이상 근무해야 발생합니다 — {365 - r.workDays}일 부족
          </div>
        </div>
      ) : (
        <div className="calc-result ok">
          <div className="calc-verdict">세금 떼고 실제로 받는 금액</div>
          <div className="calc-net">{won(r.net)}</div>
          <div className="calc-netsub">
            세전 {won(r.gross)} · 근속 {r.years}년
          </div>
        </div>
      )}

      {!r.invalid && !r.tooShort && (
        <>
          <table className="calc-table">
            <tbody>
              <tr>
                <th>재직일수</th>
                <td>{r.workDays.toLocaleString("ko-KR")}일</td>
              </tr>
              <tr>
                <th>1일 평균임금</th>
                <td>
                  {won(r.dailyAvg)}
                  <span className="calc-note"> (÷{r.periodDays}일)</span>
                </td>
              </tr>
              <tr>
                <th>퇴직금 (세전)</th>
                <td>{won(r.gross)}</td>
              </tr>
              <tr>
                <th>퇴직소득세</th>
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

          {bonusYear === 0 && leavePayYear === 0 && (
            <p className="calc-hint">
              💡 상여금과 연차수당도 <b>평균임금에 포함</b>됩니다. 최근 1년치를 넣으면
              퇴직금이 올라갑니다. 회사가 월급만으로 계산해 통보하는 경우가 있으니
              급여명세서를 확인해보세요.
            </p>
          )}
          <p className="calc-hint">
            💡 퇴직소득세는 근속연수가 길수록 급격히 줄어듭니다. 지금 실효세율은{" "}
            <b>{r.effectiveTaxRate.toFixed(1)}%</b>입니다. IRP 계좌로 받으면 이 세금을
            당장 내지 않고 미룰 수 있고, 연금으로 나눠 받으면 30~40% 감면됩니다.
          </p>
        </>
      )}

      <p className="calc-disclaimer">
        근로자퇴직급여보장법의 법정 퇴직금(평균임금 30일분 × 재직일수/365) 기준
        추정치입니다. 월 급여가 최근 3개월간 일정했다고 가정했으므로, 그 사이 급여가
        바뀌었거나 무급휴직·업무상 부상 기간이 있으면 실제 평균임금이 달라집니다.
        평균임금이 통상임금보다 적으면 통상임금으로 계산해야 하며(법정 최저 보장),
        퇴직연금(DC형)에 가입돼 있으면 적립금 운용 실적에 따라 금액이 달라집니다.
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
