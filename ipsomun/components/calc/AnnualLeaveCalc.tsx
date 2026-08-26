"use client";

import { useEffect, useMemo, useState } from "react";
import { MONTHLY_WORK_HOURS, annualLeaveDays, won } from "@/lib/taxRates";

/**
 * 연차 개수 · 연차수당 계산기.
 *
 * 입력이 가장 적은 계산기다. 입사일만 있으면 연차 개수가 나온다.
 * 사람들이 헷갈리는 건 두 곳이다 —
 *  ① 1년 미만일 때 매달 1일씩 붙는 것 (최대 11일)
 *  ② 3년째부터 2년마다 1일씩 늘어 25일에서 멈추는 것
 * 수당은 '1일 통상임금 × 남은 연차'인데, 통상임금을 월급÷209시간으로
 * 구한다는 걸 모르면 금액이 안 맞는다.
 */

const DAY = 86_400_000;
const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * 서버와 클라이언트의 '오늘'이 다르면 하이드레이션이 깨진다.
 * 그렇다고 빈 값으로 두면 서버가 뱉는 HTML에 계산 결과가 통째로 빠져서
 * 크롤러가 빈 페이지로 본다. 그래서 고정값으로 그려두고 마운트 직후 오늘로 바꾼다.
 */
const SSR_FALLBACK_DATE = "2026-01-01";

/** 만 개월 수 — 날짜 차이가 아니라 달을 세야 연차가 맞는다 */
function monthsBetween(from: Date, to: Date) {
  let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) m -= 1;
  return m;
}

export default function AnnualLeaveCalc() {
  const [joinDate, setJoinDate] = useState("2021-03-02");
  const [asOf, setAsOf] = useState(SSR_FALLBACK_DATE);
  const [monthlyPay, setMonthlyPay] = useState(350); // 만원, 월 통상임금
  const [used, setUsed] = useState(0); // 사용한 연차

  useEffect(() => setAsOf(todayISO()), []);

  const r = useMemo(() => {
    const join = new Date(joinDate);
    const now = new Date(asOf);
    const elapsed = Math.round((now.getTime() - join.getTime()) / DAY);
    if (isNaN(elapsed) || elapsed < 0) return { invalid: true as const };

    const months = monthsBetween(join, now);
    const granted = annualLeaveDays(months);
    const remain = Math.max(0, granted - used);

    // 1일 통상임금 = (월 통상임금 ÷ 209시간) × 8시간
    const hourly = (monthlyPay * 10_000) / MONTHLY_WORK_HOURS;
    const daily = hourly * 8;
    const pay = daily * remain;

    // 다음 연차가 늘어나는 시점
    const nextAt = months < 12 ? 12 : (Math.floor(months / 12) % 2 === 0 ? Math.floor(months / 12) + 1 : Math.floor(months / 12) + 2) * 12;
    const nextDays = annualLeaveDays(nextAt);

    return {
      invalid: false as const,
      months, granted, remain, hourly, daily, pay,
      years: Math.floor(months / 12),
      underOneYear: months < 12,
      maxed: granted >= 25,
      monthsToNext: Math.max(0, nextAt - months),
      nextDays,
    };
  }, [joinDate, asOf, monthlyPay, used]);

  return (
    <div className="calc">
      <div className="calc-grid">
        <Field label="입사일" unit="">
          <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
        </Field>
        <Field label="기준일" unit="">
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Field>
        <Field label="월 통상임금" unit="만원">
          <input
            type="number" value={monthlyPay} min={0} step={10}
            onChange={(e) => setMonthlyPay(+e.target.value)}
          />
        </Field>
        <Field label="이미 쓴 연차" unit="일">
          <input
            type="number" value={used} min={0} max={25} step={1}
            onChange={(e) => setUsed(+e.target.value)}
          />
        </Field>
      </div>

      {r.invalid ? (
        <div className="calc-result no">
          <div className="calc-verdict">날짜를 확인해주세요</div>
          <div className="calc-netsub">기준일이 입사일보다 뒤여야 합니다</div>
        </div>
      ) : (
        <>
          <div className="calc-result ok">
            <div className="calc-verdict">남은 연차를 수당으로 받으면</div>
            <div className="calc-net">{won(r.pay)}</div>
            <div className="calc-netsub">
              발생 {r.granted}일 − 사용 {used}일 = <b>{r.remain}일</b>
            </div>
          </div>

          <table className="calc-table">
            <tbody>
              <tr>
                <th>근속기간</th>
                <td>
                  {r.years > 0 ? `${r.years}년 ` : ""}
                  {r.months % 12}개월
                  <span className="calc-note"> (총 {r.months}개월)</span>
                </td>
              </tr>
              <tr>
                <th>발생 연차</th>
                <td>
                  {r.granted}일
                  <span className="calc-note">
                    {r.underOneYear ? " (1년 미만 — 개근 1개월당 1일)" : ""}
                  </span>
                </td>
              </tr>
              <tr>
                <th>시간당 통상임금</th>
                <td>
                  {won(r.hourly)}
                  <span className="calc-note"> (월급 ÷ 209시간)</span>
                </td>
              </tr>
              <tr>
                <th>1일 통상임금</th>
                <td>{won(r.daily)}</td>
              </tr>
              <tr className="calc-sum">
                <th>연차수당</th>
                <td>{won(r.pay)}</td>
              </tr>
            </tbody>
          </table>

          {r.underOneYear && (
            <p className="calc-hint">
              💡 1년 미만이면 <b>1개월 개근마다 1일씩, 최대 11일</b>이 붙습니다.
              1년을 채우면 여기에 15일이 새로 생깁니다. 즉 입사 1년 시점에는
              최대 <b>26일</b>을 쥐게 됩니다.
            </p>
          )}
          {!r.underOneYear && !r.maxed && (
            <p className="calc-hint">
              💡 <b>{r.monthsToNext}개월</b> 뒤면 연차가 {r.nextDays}일로 늘어납니다.
              3년째부터 2년마다 1일씩 붙고 25일에서 멈춥니다.
            </p>
          )}
          {r.maxed && (
            <p className="calc-hint">
              💡 연차가 법정 한도인 <b>25일</b>에 도달했습니다. 근속이 더 쌓여도
              법정 연차는 여기서 늘지 않습니다.
            </p>
          )}
        </>
      )}

      <p className="calc-disclaimer">
        근로기준법 제60조의 <b>입사일 기준</b> 법정 연차입니다. 많은 회사가 회계연도
        기준으로 운영하는데, 그 경우 중간 정산 방식에 따라 개수가 달라질 수 있습니다
        (다만 퇴직 시점에 입사일 기준보다 적으면 차액을 정산해줘야 합니다).
        출근율 80% 미만인 해는 개근한 달 수만큼만 발생하며, 상시 5인 미만
        사업장에는 연차 규정이 적용되지 않습니다. 회사가 적법하게 연차사용촉진을
        했다면 미사용 연차수당이 소멸할 수 있습니다.
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
