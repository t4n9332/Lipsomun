import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CALCULATORS, getCalc, type Calc } from "@/lib/calculators";
import LoanSwitchCalc from "@/components/calc/LoanSwitchCalc";
import SalaryNetCalc from "@/components/calc/SalaryNetCalc";
import SeverancePayCalc from "@/components/calc/SeverancePayCalc";
import AdSlot from "@/components/AdSlot";

export const revalidate = 86400; // 계산 로직은 바뀌지 않는다

/**
 * 슬러그 → 계산기 컴포넌트 + 설명글.
 *
 * 계산기마다 if 문을 늘리면 계산기가 열 개가 됐을 때 이 파일이 망가진다.
 * 새 계산기는 여기 한 줄만 추가하면 된다.
 */
const REGISTRY: Record<
  string,
  { Calc: React.ComponentType; Guide: React.ComponentType }
> = {
  대출갈아타기: { Calc: LoanSwitchCalc, Guide: LoanSwitchGuide },
  연봉실수령액: { Calc: SalaryNetCalc, Guide: SalaryNetGuide },
  퇴직금: { Calc: SeverancePayCalc, Guide: SeverancePayGuide },
};

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

  const entry = REGISTRY[c.slug];
  if (!entry) notFound();
  const { Calc, Guide } = entry;

  return (
    <section className="section">
      <div className="section-head">
        <h2>
          {c.emoji} {c.short} 계산기
        </h2>
        <span className="sub">{c.desc}</span>
      </div>

      <Calc />

      <AdSlot slot="1234567890" />

      <Guide />

      <CalcBridge calc={c} />

      <p className="calc-back">
        <Link href="/calc">← 다른 계산기 보기</Link>
      </p>
    </section>
  );
}

/**
 * 계산기 페이지에서 사이트의 나머지로 나가는 다리.
 *
 * 계산기만 있으면 쇼핑 사이트에 얹힌 남의 물건처럼 보이고, 방문자도 계산만 하고 나간다.
 * 문맥이 실제로 이어지는 링크(calc.related)가 있을 때만 앞에 붙이고,
 * 없으면 사이트 공통 링크만 보여준다 — 억지로 연결하면 독자가 먼저 알아챈다.
 */
function CalcBridge({ calc }: { calc: Calc }) {
  return (
    <nav className="calc-bridge">
      <b>입소문에서 이어서 보기</b>
      <span className="calc-bridge-links">
        {calc.related?.map((r) => (
          <Link key={r.href} href={r.href}>
            {r.label}
          </Link>
        ))}
        <Link href="/compare">가격비교</Link>
        <Link href="/deals">오늘의 딜</Link>
        <Link href="/blog">리포트</Link>
      </span>
    </nav>
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

function SalaryNetGuide() {
  return (
    <article className="calc-guide">
      <h3>연봉의 몇 %가 사라지나</h3>
      <p>
        세전 연봉에서 빠져나가는 건 네 가지 보험과 두 가지 세금, 모두 여섯 항목이다.
        연봉 3천만원대에서는 대략 <b>13~15%</b>, 5천만원대에서는 <b>16~18%</b>,
        1억을 넘으면 <b>22% 안팎</b>이 빠진다. 세금은 누진이라 연봉이 오를수록
        떼는 비율도 같이 오른다.
      </p>

      <h3>비과세 식대 20만원이 만드는 차이</h3>
      <p>
        식대는 월 20만원까지 세금도 보험료도 붙지 않는다. 같은 연봉이라도 급여명세서에
        식대 항목이 잡혀 있으면 실수령액이 <b>월 3만원 안팎</b> 더 많다.
        계약할 때 총액만 보고 넘어가기 쉬운데, 식대를 따로 잡아달라고 요청하면
        회사도 부담이 늘지 않으면서 내 손에 들어오는 돈은 늘어난다.
      </p>

      <h3>국민연금은 어느 지점부터 더 안 뗀다</h3>
      <p>
        국민연금에는 상한이 있다. 월 소득 <b>617만원</b>(연봉 약 7,400만원)을 넘으면
        그 위로는 아무리 벌어도 보험료가 더 붙지 않는다. 위 계산기에서 연봉을
        7,000만원과 9,000만원으로 바꿔 국민연금 줄만 보면 금액이 같은 데서 멈춰 있다.
        고연봉일수록 공제율 그래프가 완만해지는 이유다.
      </p>

      <h3>장기요양보험은 소득이 아니라 건강보험료에 붙는다</h3>
      <p>
        자주 틀리는 부분이다. 장기요양보험료는 월급에 요율을 곱하는 게 아니라
        <b>건강보험료에 12.95%</b>를 곱해서 나온다. 그래서 금액이 작아 보여도
        건강보험료가 오르면 같이 따라 오른다.
      </p>

      <h3>이 계산과 실제 급여명세서가 다른 이유</h3>
      <p>
        매달 급여에서 떼는 소득세는 국세청 <b>간이세액표</b>를 따른다. 이건 임시로
        걷는 금액이고, 실제 낼 세금은 이듬해 2월 연말정산에서 확정된다.
        위 계산기는 그 확정 기준(연말정산 방식)으로 계산하므로 1년 전체로 보면
        이쪽이 실제에 가깝다. 의료비·신용카드·연금저축 공제까지 받으면
        실수령액은 여기 나온 값보다 더 올라간다.
      </p>
    </article>
  );
}

function SeverancePayGuide() {
  return (
    <article className="calc-guide">
      <h3>퇴직금은 &lsquo;마지막 월급 × 근속연수&rsquo;가 아니다</h3>
      <p>
        법정 퇴직금은 <b>1일 평균임금 × 30일 × (재직일수 ÷ 365)</b>로 계산한다.
        여기서 평균임금은 마지막 월급이 아니라 <b>퇴직 직전 3개월</b>에 받은 임금
        총액을 그 기간의 실제 일수로 나눈 값이다. 3개월 일수는 달마다 89일에서
        92일까지 달라져서, 같은 월급이라도 언제 그만두느냐에 따라 금액이 조금 달라진다.
      </p>

      <h3>상여금과 연차수당이 빠지면 손해다</h3>
      <p>
        평균임금에는 최근 1년치 상여금의 <b>4분의 1</b>과 연차수당의 <b>4분의 1</b>이
        더해진다(3개월분에 해당하는 몫). 회사가 기본급만으로 계산해 통보하는 경우가
        있는데, 상여금이 연 400만원이라면 평균임금이 올라가면서 퇴직금이 백만원 단위로
        늘어날 수 있다. 위 계산기에 상여금을 0에서 실제 금액으로 바꿔 넣으면
        차이가 바로 보인다.
      </p>

      <h3>1년에서 하루라도 모자라면 0원이다</h3>
      <p>
        계속근로기간이 <b>1년 미만</b>이면 퇴직금이 발생하지 않는다. 364일과 365일
        사이에 수백만원이 갈린다. 주 15시간 미만 근로자도 대상에서 제외된다.
        퇴사일을 조정할 수 있는 상황이라면 이 날짜부터 확인하는 게 맞다.
      </p>

      <h3>퇴직소득세는 오래 일할수록 싸진다</h3>
      <p>
        퇴직소득세는 일반 소득세와 계산 구조가 다르다. 퇴직금에서 근속연수만큼 공제를
        빼고, 남은 금액을 근속연수로 나눠 12를 곱한 뒤(환산급여) 세율을 매기고,
        다시 근속연수를 곱해 되돌린다. 이 과정 때문에 <b>같은 금액이라도 오래 다닌
        사람의 세금이 훨씬 적다</b>. 20년 근속이면 실효세율이 한 자릿수로 떨어지는
        경우가 흔하다.
      </p>

      <h3>IRP로 받으면 세금을 미룰 수 있다</h3>
      <p>
        퇴직금을 일시금 통장이 아니라 <b>IRP 계좌</b>로 받으면 퇴직소득세를 당장 내지
        않는다. 나중에 연금 형태로 나눠 받을 때 원래 세금의 <b>60~70%</b>만 내면 된다
        (수령 기간이 길수록 더 깎인다). 55세 이전에 퇴직해 당장 돈이 필요한 게
        아니라면 IRP를 먼저 열어두는 쪽이 유리하다.
      </p>

      <p className="calc-src">
        DC형 퇴직연금에 가입돼 있다면 위 계산식이 아니라 적립금 운용 실적으로
        금액이 정해진다. 본인이 DB형인지 DC형인지는 회사 인사팀이나
        가입된 금융사 앱에서 확인할 수 있다.
      </p>
    </article>
  );
}
