"use client";

import { useMemo, useState } from "react";
import { PENSION_CREDIT, pensionCreditRate, won } from "@/lib/taxRates";

/**
 * IRP·연금저축 세액공제 계산기.
 *
 * 퇴직금 계산기에서 "IRP로 받으면 세금을 미룰 수 있다"고 안내해놓고
 * 정작 그 계산기가 없었다. 그 자리를 메우는 계산기다.
 *
 * 여기서 반드시 짚어야 하는 것 두 가지 —
 *  ① 퇴직금을 IRP로 받은 금액은 세액공제 대상이 아니다 (본인이 더 넣은 돈만 해당).
 *    이걸 모르고 "IRP에 5천만원 들어왔으니 공제 받겠지" 하는 사람이 많다.
 *  ② 연금저축은 600만원까지, IRP를 합쳐야 900만원까지다. 한 칸씩 채우는 순서가 있다.
 */

export default function PensionCreditCalc() {
  const [gross, setGross] = useState(5000); // 만원, 총급여
  const [pension, setPension] = useState(300); // 만원, 연금저축 연 납입
  const [irp, setIrp] = useState(300); // 만원, IRP 연 납입

  const r = useMemo(() => {
    const grossWon = gross * 10_000;
    const p = Math.max(0, pension) * 10_000;
    const i = Math.max(0, irp) * 10_000;

    // ① 연금저축은 600만원에서 먼저 잘린다
    const pensionEligible = Math.min(p, PENSION_CREDIT.pensionOnlyCap);
    const pensionCut = p - pensionEligible;

    // ② 둘을 합쳐 900만원에서 다시 잘린다
    const eligible = Math.min(pensionEligible + i, PENSION_CREDIT.totalCap);
    const totalCut = pensionEligible + i - eligible + pensionCut;

    const rate = pensionCreditRate(grossWon);
    const credit = eligible * rate;

    // 한도까지 더 넣으면 얼마를 더 받나 — 연말에 이걸 알고 싶어서 검색한다
    const room = PENSION_CREDIT.totalCap - eligible;
    const pensionRoom = Math.max(0, PENSION_CREDIT.pensionOnlyCap - pensionEligible);
    const extraCredit = room * rate;

    return {
      eligible, credit, rate, room, pensionRoom, extraCredit,
      totalCut,
      paid: p + i,
      isHighRate: grossWon <= PENSION_CREDIT.highRateGrossLimit,
      returnPct: p + i > 0 ? (credit / (p + i)) * 100 : 0,
      nearLine:
        grossWon > PENSION_CREDIT.highRateGrossLimit &&
        grossWon <= PENSION_CREDIT.highRateGrossLimit + 3_000_000,
    };
  }, [gross, pension, irp]);

  return (
    <div className="calc">
      <div className="calc-grid">
        <Field label="총급여 (연)" unit="만원">
          <input
            type="number" value={gross} min={0} step={100}
            onChange={(e) => setGross(+e.target.value)}
          />
        </Field>
        <Field label="연금저축 납입액 (연)" unit="만원">
          <input
            type="number" value={pension} min={0} step={10}
            onChange={(e) => setPension(+e.target.value)}
          />
        </Field>
        <Field label="IRP 납입액 (연)" unit="만원">
          <input
            type="number" value={irp} min={0} step={10}
            onChange={(e) => setIrp(+e.target.value)}
          />
        </Field>
      </div>

      <div className="calc-result ok">
        <div className="calc-verdict">연말정산에서 돌려받는 금액</div>
        <div className="calc-net">{won(r.credit)}</div>
        <div className="calc-netsub">
          공제 대상 {won(r.eligible)} × {(r.rate * 100).toFixed(1)}%
          {r.paid > 0 && ` · 넣은 돈의 ${r.returnPct.toFixed(1)}%`}
        </div>
      </div>

      <table className="calc-table">
        <tbody>
          <tr>
            <th>납입한 금액</th>
            <td>{won(r.paid)}</td>
          </tr>
          <tr>
            <th>공제 대상 금액</th>
            <td>
              {won(r.eligible)}
              {r.totalCut > 0 && (
                <span className="calc-note"> (한도 초과 {won(r.totalCut)} 제외)</span>
              )}
            </td>
          </tr>
          <tr>
            <th>공제율</th>
            <td>
              {(r.rate * 100).toFixed(1)}%
              <span className="calc-note">
                {r.isHighRate ? " (총급여 5,500만원 이하)" : " (총급여 5,500만원 초과)"}
              </span>
            </td>
          </tr>
          <tr className="calc-sum">
            <th>돌려받는 세액</th>
            <td>{won(r.credit)}</td>
          </tr>
        </tbody>
      </table>

      {/* 연금저축에서 넘친 돈이 있는데 IRP 여유도 남았다면, '더 넣어라'와 '넘쳤다'를
          따로 말하면 서로 부딪힌다. 실제로 할 일은 하나다 — 옮기는 것. */}
      {r.totalCut > 0 && r.room > 0 ? (
        <p className="calc-hint">
          💡 <b>넣는 곳만 바꾸면 {won(Math.min(r.totalCut, r.room) * r.rate)}을 더
          받습니다.</b> 연금저축 한도(600만원)를 넘긴 {won(r.totalCut)} 중{" "}
          {won(Math.min(r.totalCut, r.room))}을 IRP로 옮기면 그대로 공제 대상이 됩니다.
          같은 돈인데 계좌만 다릅니다.
        </p>
      ) : null}
      {r.room > 0 && r.totalCut === 0 && (
        <p className="calc-hint">
          💡 한도까지 <b>{won(r.room)}</b>을 더 넣을 수 있습니다. 채우면{" "}
          <b>{won(r.extraCredit)}</b>을 더 돌려받습니다.
          {r.pensionRoom > 0 && r.pensionRoom < r.room && (
            <>
              {" "}
              이 중 {won(r.pensionRoom)}까지는 <b>연금저축</b>에, 나머지는 IRP에
              넣어야 합니다.
            </>
          )}
          {r.pensionRoom === 0 && " 연금저축은 600만원이 꽉 찼으니 IRP에 넣으세요."}
        </p>
      )}
      {r.totalCut > 0 && r.room === 0 && (
        <p className="calc-hint">
          💡 한도를 넘긴 <b>{won(r.totalCut)}</b>은 공제를 못 받습니다. 연금저축은
          600만원까지, IRP를 합쳐도 900만원까지입니다. 넘긴 만큼은 그냥 묶이는 돈이라
          다른 곳에 두는 편이 낫습니다.
        </p>
      )}
      {r.nearLine && (
        <p className="calc-hint">
          💡 총급여가 5,500만원 선을 조금 넘었습니다. 이 선 하나로 공제율이
          16.5%에서 13.2%로 떨어져 <b>최대 30만원 가까이</b> 차이가 납니다.
          비과세 식대 등으로 총급여가 5,500만원 이하로 잡히는지 급여명세서를
          확인해볼 가치가 있습니다.
        </p>
      )}
      <p className="calc-hint">
        ⚠️ <b>퇴직금을 IRP로 받은 금액은 세액공제 대상이 아닙니다.</b> 그건 세금을
        미루는(이연) 것이고, 위 계산은 <b>본인이 따로 넣은 돈</b>에만 해당합니다.
        IRP 잔고가 커도 공제는 추가 납입액 기준입니다.
      </p>

      <p className="calc-disclaimer">
        공제율은 지방소득세를 포함한 값입니다(15%+1.5% / 12%+1.2%). 세액공제는 내야 할
        세금을 깎아주는 것이라, 결정세액이 0이면 아무리 넣어도 돌려받을 세금이
        없습니다. 근로소득 외 소득이 있으면 총급여가 아닌 종합소득금액(4,500만원)이
        기준이 됩니다. ISA 만기자금을 연금계좌로 옮기면 별도로 추가 공제가 있으며
        위 계산에는 포함하지 않았습니다. 연금 수령 전에 중도해지하면 공제받은 금액을
        기타소득세(16.5%)로 토해내야 하므로, 당장 쓸 돈은 넣지 마세요.
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
