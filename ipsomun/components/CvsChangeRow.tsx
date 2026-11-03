import { brandName, type CvsChange } from "@/lib/cvs";
import { won } from "@/lib/util";

const LABEL = { buff: "▲ 버프", nerf: "▼ 너프", new: "✚ 신규", ended: "✖ 종료" } as const;

/** 패치노트 한 줄 — "GS25 몬스터 울트라 2+1 → 1+1 (1개당 1,800원 → 1,350원, -25%)" */
export default function CvsChangeRow({ c }: { c: CvsChange }) {
  return (
    <li className={`cvs-change k-${c.kind}`} data-name={c.n.toLowerCase()}>
      <span className="tag">{LABEL[c.kind]}</span>
      <span className={`cvs-brand b-${c.b}`}>{brandName(c.b)}</span>
      <span className="nm">{c.n}</span>
      <span className="what">
        {c.before && c.after ? (
          <>
            {c.typeChanged ? (
              <>
                {c.before.t} → <b>{c.after.t}</b>
              </>
            ) : (
              <>
                {c.after.t} 유지 · 정가 {won(c.before.p)} → <b>{won(c.after.p)}</b>
              </>
            )}
            <em>
              1개당 {won(c.before.unit)} → {won(c.after.unit)} ({c.pct > 0 ? "+" : ""}
              {Math.round(c.pct * 100)}%)
            </em>
          </>
        ) : c.after ? (
          <>
            <b>{c.after.t}</b> <em>1개당 {won(c.after.unit)}</em>
          </>
        ) : (
          <>
            {c.before?.t} 행사 끝 <em>지난달 1개당 {won(c.before?.unit)}</em>
          </>
        )}
      </span>
    </li>
  );
}
