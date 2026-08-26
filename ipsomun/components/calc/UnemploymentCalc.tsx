"use client";

import { useMemo, useState } from "react";
import { UNEMPLOYMENT, unemploymentDays, won } from "@/lib/taxRates";

/**
 * 실업급여(구직급여) 계산기.
 *
 * 퇴직금 계산기와 입력값이 거의 같다 — 입사일·퇴사일·월급.
 * 퇴직금을 계산해본 사람이 바로 다음에 찾는 게 이것이라 같은 형태로 맞췄다.
 *
 * 핵심은 두 가지다.
 *  ① 하루 얼마 (평균임금의 60%, 상·하한에 걸린다)
 *  ② 며칠 받나 (나이 × 가입기간 표)
 * 사람들이 정작 궁금한 건 ②를 곱한 총액인데 그걸 보여주는 곳이 드물다.
 */

const DAY = 86_400_000;

function daysInLast3Months(end: Date) {
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));
}

export default function UnemploymentCalc() {
  const [joinDate, setJoinDate] = useState("2021-03-02");
  const [leaveDate, setLeaveDate] = useState("2026-03-02");
  const [monthlyPay, setMonthlyPay] = useState(350); // 만원
  const [bonusYear, setBonusYear] = useState(0); // 만원
  const [age, setAge] = useState(35);
  const [disabled, setDisabled] = useState(false);

  const r = useMemo(() => {
    const join = new Date(joinDate);
    const leave = new Date(leaveDate);
    const workDays = Math.round((leave.getTime() - join.getTime()) / DAY);
    if (!workDays || workDays <= 0 || isNaN(workDays)) {
      return { invalid: true as const };
    }

    const periodDays = daysInLast3Months(leave);
    const total = monthlyPay * 10_000 * 3 + (bonusYear * 10_000 * 3) / 12;
    const dailyAvg = total / periodDays; // 1일 평균임금

    // ① 구직급여일액 = 평균임금 × 60% → 상한으로 자르고 → 하한으로 올린다
    const raw = dailyAvg * UNEMPLOYMENT.rate;
    const capped = Math.min(raw, UNEMPLOYMENT.dailyCap);
    const daily = Math.max(capped, UNEMPLOYMENT.dailyFloor);

    // ② 소정급여일수
    const insuredYears = workDays / 365;
    const days = unemploymentDays(insuredYears, age >= 50 || disabled);

    return {
      invalid: false as const,
      workDays, periodDays, dailyAvg, raw, daily, days,
      insuredYears,
      total: daily * days,
      months: days / 30,
      hitCap: raw > UNEMPLOYMENT.dailyCap,
      hitFloor: capped < UNEMPLOYMENT.dailyFloor,
      tooShort: workDays < 180,
    };
  }, [joinDate, leaveDate, monthlyPay, bonusYear, age, disabled]);

  return (
    <div className="calc">
      <div className="calc-grid">
        <Field label="입사일" unit="">
          <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
        </Field>
        <Field label="퇴사일" unit="">
          <input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
        </Field>
        <Field label="퇴직 전 월 급여" unit="만원">
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
        <Field label="만 나이" unit="세">
          <input
            type="number" value={age} min={15} max={99} step={1}
            onChange={(e) => setAge(+e.target.value)}
          />
        </Field>
        <label className="calc-field calc-check">
          <span className="calc-label">장애인</span>
          <span className="calc-input">
            <input
              type="checkbox" checked={disabled}
              onChange={(e) => setDisabled(e.target.checked)}
            />
            <em>해당하면 체크 (기간 우대)</em>
          </span>
        </label>
      </div>

      {r.invalid ? (
        <div className="calc-result no">
          <div className="calc-verdict">날짜를 확인해주세요</div>
          <div className="calc-netsub">퇴사일이 입사일보다 뒤여야 합니다</div>
        </div>
      ) : (
        <div className={`calc-result ${r.tooShort ? "no" : "ok"}`}>
          <div className="calc-verdict">
            {r.tooShort ? "가입기간이 부족할 수 있습니다" : "총 예상 수령액"}
          </div>
          <div className="calc-net">{won(r.total)}</div>
          <div className="calc-netsub">
            하루 {won(r.daily)} × {r.days}일 (약 {r.months.toFixed(1)}개월)
          </div>
        </div>
      )}

      {!r.invalid && (
        <>
          <table className="calc-table">
            <tbody>
              <tr>
                <th>1일 평균임금</th>
                <td>{won(r.dailyAvg)}</td>
              </tr>
              <tr>
                <th>구직급여일액</th>
                <td>
                  {won(r.daily)}
                  <span className="calc-note">
                    {r.hitFloor
                      ? " (하한 적용)"
                      : r.hitCap
                      ? " (상한 적용)"
                      : " (평균임금의 60%)"}
                  </span>
                </td>
              </tr>
              <tr>
                <th>소정급여일수</th>
                <td>
                  {r.days}일
                  <span className="calc-note">
                    {" "}
                    (가입 {r.insuredYears.toFixed(1)}년·
                    {age >= 50 || disabled ? "50세 이상/장애인" : "50세 미만"})
                  </span>
                </td>
              </tr>
              <tr className="calc-sum">
                <th>총 예상 수령액</th>
                <td>{won(r.total)}</td>
              </tr>
            </tbody>
          </table>

          {r.tooShort && (
            <p className="calc-hint">
              💡 이직 전 18개월 동안 <b>피보험단위기간 180일</b> 이상이어야 받을 수
              있습니다. 재직일수가 {r.workDays}일이라 이전 직장 기간을 합쳐야 할 수
              있습니다. 고용보험 홈페이지에서 본인 가입이력을 먼저 확인하세요.
            </p>
          )}
          {r.hitCap && !r.hitFloor && (
            <p className="calc-hint">
              💡 상한액에 걸렸습니다. 구직급여는 하루 <b>{won(UNEMPLOYMENT.dailyCap)}</b>이
              최대라, 이 위로는 월급이 아무리 높아도 받는 금액이 같습니다.
            </p>
          )}
          {r.hitFloor && (
            <p className="calc-hint">
              💡 하한액이 적용됐습니다. 구직급여 하한은 최저임금을 따라 매년 오르는데
              상한은 2019년부터 묶여 있어서, 지금은 하한이 상한을 넘어섰습니다.
              그래서 월급이 높아도 하루 금액이 <b>{won(UNEMPLOYMENT.dailyFloor)}</b>에
              수렴합니다.
            </p>
          )}
          <p className="calc-hint">
            💡 금액보다 <b>일수</b>가 총액을 더 크게 좌우합니다. 상한에 걸리는
            급여대라면 하루 금액은 어차피 같고, 가입기간 1년 차이로 30일(약 200만원)이
            갈립니다. 위에서 입사일만 바꿔보면 바로 보입니다.
          </p>
        </>
      )}

      <p className="calc-disclaimer">
        비자발적 이직(권고사직·계약만료·정당한 사유의 자발적 퇴사 등)이고, 이직 전
        18개월간 피보험단위기간이 180일 이상일 때 받을 수 있습니다.
        자발적 퇴사는 원칙적으로 대상이 아닙니다. 1일 소정근로 8시간을 기준으로 했으며
        단시간 근로자는 금액이 달라집니다. 상·하한액과 최저임금은 매년 고시되므로
        실제 지급액은 고용센터 결정에 따릅니다.
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
