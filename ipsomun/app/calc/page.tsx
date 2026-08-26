import Link from "next/link";
import { groupedCalculators, CALCULATORS } from "@/lib/calculators";

export const revalidate = 86400;

export const metadata = {
  title: "생활 계산기",
  description:
    "연봉 실수령액, 퇴직금, 대출 갈아타기까지. 숫자만 넣으면 세금까지 뺀 " +
    "실제 금액이 바로 나옵니다. 가입도 설치도 필요 없습니다.",
  alternates: { canonical: "/calc" },
};

/** 앵커 링크로 쓰려면 한글 그룹명에서 가운뎃점을 빼야 한다 */
const anchor = (g: string) => `g-${g.replace(/·/g, "-")}`;

export default function CalcHub() {
  const groups = groupedCalculators();

  return (
    <section className="section">
      <div className="section-head">
        <h2>🧮 생활 계산기</h2>
        <span className="sub">
          숫자만 넣으면 바로 답이 나옵니다 — 가입도, 설치도 필요 없습니다
        </span>
      </div>

      <p className="calc-intro">
        입소문은 사기 전에 확인하는 곳입니다. 물건만 그런 게 아니라 돈 쓰는 결정도
        마찬가지라서, 계산이 필요한 것들을 여기 모았습니다. 세금과 수수료까지 빼고
        <b> 실제로 손에 남는 금액</b>을 보여주는 것이 기준입니다.
      </p>

      {groups.length > 1 && (
        <nav className="calc-groupnav">
          {groups.map((g) => (
            <a key={g.group} href={`#${anchor(g.group)}`}>
              {g.group}
            </a>
          ))}
        </nav>
      )}

      {groups.map((g) => (
        <div key={g.group} className="calc-group">
          <h3 id={anchor(g.group)} className="calc-group-title">
            {g.group}
            <span>{g.items.length}개</span>
          </h3>
          <div className="calc-list">
            {g.items.map((c) => (
              <Link
                key={c.slug}
                href={`/calc/${encodeURIComponent(c.slug)}`}
                className="calc-card"
              >
                <span className="calc-emoji">{c.emoji}</span>
                <span className="calc-card-body">
                  <b>{c.short} 계산기</b>
                  <em>{c.desc}</em>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <p className="calc-src">
        현재 {CALCULATORS.length}개이며 계속 늘려갑니다. 필요한 계산기가 있으면
        <a href="mailto:t4n9332@gmail.com"> 알려주세요</a>.
      </p>
    </section>
  );
}
