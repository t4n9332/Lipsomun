import Link from "next/link";
import { CALCULATORS } from "@/lib/calculators";

export const revalidate = 86400;

export const metadata = {
  title: "생활 계산기",
  description:
    "대출 갈아타기부터 실생활에 필요한 계산을 숫자만 넣으면 바로 확인할 수 있습니다.",
  alternates: { canonical: "/calc" },
};

export default function CalcHub() {
  return (
    <section className="section">
      <div className="section-head">
        <h2>🧮 생활 계산기</h2>
        <span className="sub">
          숫자만 넣으면 바로 답이 나옵니다 — 가입도, 설치도 필요 없습니다
        </span>
      </div>

      <div className="calc-list">
        {CALCULATORS.map((c) => (
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
    </section>
  );
}
