"use client";

import { useMemo, useState } from "react";

/**
 * 주택담보대출 갈아타기 이득 계산기.
 *
 * 사람들이 앱에서 보는 건 금리 차이뿐이다. 그런데 갈아탈 때 나가는 돈이 있어서
 * 금리가 낮아져도 손해가 나는 구간이 있다. 그 손익분기를 눈으로 보여주는 게 목적.
 */

const won = (n: number) =>
  n.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "원";

/** 원리금균등 상환 기준, 남은 기간 동안 내는 총이자 */
function totalInterest(principal: number, annualRate: number, years: number) {
  const n = Math.round(years * 12);
  const r = annualRate / 100 / 12;
  if (n <= 0 || principal <= 0) return 0;
  if (r === 0) return 0;
  const pay = (principal * r) / (1 - Math.pow(1 + r, -n)); // 월 상환액
  return pay * n - principal;
}

export default function LoanSwitchCalc() {
  const [principal, setPrincipal] = useState(20000); // 만원
  const [nowRate, setNowRate] = useState(4.5);
  const [newRate, setNewRate] = useState(4.0);
  const [years, setYears] = useState(15);
  const [monthsSince, setMonthsSince] = useState(24); // 실행 후 개월
  const [feeRate, setFeeRate] = useState(1.2);

  const r = useMemo(() => {
    const P = principal * 10000;

    // ① 아낄 이자 = 지금 조건 총이자 − 갈아탄 조건 총이자
    const saved = totalInterest(P, nowRate, years) - totalInterest(P, newRate, years);

    // ② 중도상환수수료 = 남은 원금 × 요율 × (3년까지 남은 개월 ÷ 36)
    //    3년이 지나면 대개 면제된다
    const remainMonths = Math.max(0, 36 - monthsSince);
    const fee = P * (feeRate / 100) * (remainMonths / 36);

    const net = saved - fee;

    // 손익분기: 몇 개월이 더 지나야 이득으로 돌아서는가
    let breakEvenMonth: number | null = null;
    if (net < 0) {
      for (let m = monthsSince + 1; m <= 36; m++) {
        const f = P * (feeRate / 100) * (Math.max(0, 36 - m) / 36);
        if (saved - f >= 0) {
          breakEvenMonth = m - monthsSince;
          break;
        }
      }
    }
    return { saved, fee, net, remainMonths, breakEvenMonth };
  }, [principal, nowRate, newRate, years, monthsSince, feeRate]);

  const good = r.net > 0;

  return (
    <div className="calc">
      <div className="calc-grid">
        <Field label="남은 원금" unit="만원">
          <input
            type="number" value={principal} min={0} step={100}
            onChange={(e) => setPrincipal(+e.target.value)}
          />
        </Field>
        <Field label="남은 기간" unit="년">
          <input
            type="number" value={years} min={1} max={40} step={1}
            onChange={(e) => setYears(+e.target.value)}
          />
        </Field>
        <Field label="지금 금리" unit="%">
          <input
            type="number" value={nowRate} min={0} max={20} step={0.1}
            onChange={(e) => setNowRate(+e.target.value)}
          />
        </Field>
        <Field label="갈아탈 금리" unit="%">
          <input
            type="number" value={newRate} min={0} max={20} step={0.1}
            onChange={(e) => setNewRate(+e.target.value)}
          />
        </Field>
        <Field label="실행한 지" unit="개월">
          <input
            type="number" value={monthsSince} min={0} max={120} step={1}
            onChange={(e) => setMonthsSince(+e.target.value)}
          />
        </Field>
        <Field label="중도상환 요율" unit="%">
          <input
            type="number" value={feeRate} min={0} max={5} step={0.1}
            onChange={(e) => setFeeRate(+e.target.value)}
          />
        </Field>
      </div>

      <div className={`calc-result ${good ? "ok" : "no"}`}>
        <div className="calc-verdict">
          {good ? "갈아타면 이득입니다" : "지금은 갈아타면 손해입니다"}
        </div>
        <div className="calc-net">{won(Math.abs(Math.round(r.net)))}</div>
        <div className="calc-netsub">{good ? "만큼 남습니다" : "만큼 모자랍니다"}</div>
      </div>

      <table className="calc-table">
        <tbody>
          <tr>
            <th>① 아낄 이자</th>
            <td>{won(Math.round(r.saved))}</td>
          </tr>
          <tr>
            <th>② 중도상환수수료</th>
            <td>
              {won(Math.round(r.fee))}
              <span className="calc-note">
                {r.remainMonths > 0
                  ? ` (3년까지 ${r.remainMonths}개월 남음)`
                  : " (3년 경과 — 면제)"}
              </span>
            </td>
          </tr>
          <tr className="calc-sum">
            <th>① − ②</th>
            <td>{won(Math.round(r.net))}</td>
          </tr>
        </tbody>
      </table>

      {r.breakEvenMonth && (
        <p className="calc-hint">
          💡 <b>{r.breakEvenMonth}개월</b> 뒤에 다시 계산해보세요. 그때는 수수료가 줄어
          이득으로 돌아섭니다.
        </p>
      )}
      {good && r.remainMonths > 0 && (
        <p className="calc-hint">
          💡 3년이 지나면 수수료가 사라져 <b>{won(Math.round(r.saved))}</b>를 온전히
          아낄 수 있습니다. 급하지 않다면 {r.remainMonths}개월 기다리는 것도 방법입니다.
        </p>
      )}

      <p className="calc-disclaimer">
        원리금균등 상환을 기준으로 한 추정치입니다. 중도상환 요율과 면제 조건은
        금융사·상품마다 다르니 계약서나 앱에서 확인한 숫자를 넣어 다시 계산해보세요.
        실제 심사 결과에 따라 한도와 금리가 달라질 수 있습니다.
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
