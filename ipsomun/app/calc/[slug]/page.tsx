import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CALCULATORS, getCalc } from "@/lib/calculators";
import LoanSwitchCalc from "@/components/calc/LoanSwitchCalc";
import AdSlot from "@/components/AdSlot";

export const revalidate = 86400; // 계산 로직은 바뀌지 않는다

export function generateStaticParams() {
  return CALCULATORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const c = getCalc(slug);
  if (!c) return {};
  return {
    title: c.title,
    description: c.desc,
    keywords: c.keywords,
    alternates: { canonical: `/calc/${encodeURIComponent(c.slug)}` },
    openGraph: { title: c.title, description: c.desc },
  };
}

export default async function CalcPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const c = getCalc(slug);
  if (!c) notFound();

  return (
    <section className="section">
      <div className="section-head">
        <h2>
          {c.emoji} {c.short} 계산기
        </h2>
        <span className="sub">{c.desc}</span>
      </div>

      {c.slug === "대출갈아타기" && <LoanSwitchCalc />}

      <AdSlot slot="1234567890" />

      {c.slug === "대출갈아타기" && <LoanSwitchGuide />}

      <p className="calc-back">
        <Link href="/calc">← 다른 계산기 보기</Link>
      </p>
    </section>
  );
}

/** 계산기만 덩그러니 있으면 애드센스가 '가치 있는 콘텐츠 없음'으로 본다. 설명이 함께 있어야 한다. */
function LoanSwitchGuide() {
  return (
    <article className="calc-guide">
      <h3>왜 금리만 보면 안 되나</h3>
      <p>
        앱 화면에는 금리 차이가 크게 표시된다. 하지만 갈아탈 때 나가는 돈이 따로 있다.
        그 돈이 아낀 이자보다 크면 금리가 낮아져도 손해다.
      </p>

      <h3>중도상환수수료는 시간이 깎아준다</h3>
      <p>
        이 수수료는 보통 실행 시점부터 3년에 걸쳐 줄어들다가 사라지는 구조다.
        실행한 지 2년 11개월이라면, 한 달만 기다렸다가 움직이는 쪽이 이득일 수 있다.
        위 계산기에 개월 수를 바꿔 넣어보면 차이가 바로 보인다.
      </p>

      <h3>남은 기간이 짧으면 갈아탈 이유가 사라진다</h3>
      <p>
        갈아타기의 이득은 금리 차이보다 <b>남은 기간</b>에 더 크게 좌우된다.
        만기가 가까우면 아낄 이자 자체가 적어서 수수료를 넘지 못한다.
        위 계산기에서 남은 기간만 <b>1년</b>으로 바꿔보면 같은 금리 차이인데도
        결과가 손해로 뒤집힌다. 실행한 지 얼마 안 돼 수수료가 크면 그 경계는
        4년 근처까지 밀려난다.
      </p>

      <h3>계산이 맞아도 확인할 것이 하나 더 있다</h3>
      <p>
        갈아탈 때는 지금 기준으로 심사를 다시 받는다. 그 사이 규제나 내 소득 상황이
        달라졌으면 받을 수 있는 금액이 줄어들 수 있다. 남은 원금만큼 새로 못 받으면
        차액을 현금으로 메워야 한다. 조회 단계에서 한도부터 확인하는 게 순서다.
      </p>

      <p className="calc-src">
        조회는 무료이고 신용점수에도 영향이 없다. 요건은 해마다 조정되므로
        본인이 대상인지는 금융사 앱에서 직접 조회하는 쪽이 정확하다.
      </p>
    </article>
  );
}
