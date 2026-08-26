import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  CALCULATORS,
  getCalc,
  siblingCalculators,
  type Calc,
} from "@/lib/calculators";
import LoanSwitchCalc from "@/components/calc/LoanSwitchCalc";
import SalaryNetCalc from "@/components/calc/SalaryNetCalc";
import SeverancePayCalc from "@/components/calc/SeverancePayCalc";
import UnemploymentCalc from "@/components/calc/UnemploymentCalc";
import AnnualLeaveCalc from "@/components/calc/AnnualLeaveCalc";
import PensionCreditCalc from "@/components/calc/PensionCreditCalc";
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
  실업급여: { Calc: UnemploymentCalc, Guide: UnemploymentGuide },
  연차수당: { Calc: AnnualLeaveCalc, Guide: AnnualLeaveGuide },
  연금저축IRP세액공제: { Calc: PensionCreditCalc, Guide: PensionCreditGuide },
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

      <CalcSiblings slug={c.slug} />

      <CalcBridge calc={c} />

      <p className="calc-back">
        <Link href="/calc">← 다른 계산기 보기</Link>
      </p>
    </section>
  );
}

/**
 * 같은 그룹의 다른 계산기.
 *
 * 체류시간이 광고 단가를 올린다는 게 이 계산기들의 전제인데, 계산 한 번 하고
 * 나가버리면 그 전제가 무너진다. 퇴직금을 계산한 사람은 실업급여를,
 * 실업급여를 본 사람은 연차수당을 곧바로 찾는다 — 그 흐름을 끊지 않는다.
 */
function CalcSiblings({ slug }: { slug: string }) {
  const siblings = siblingCalculators(slug);
  if (siblings.length === 0) return null;

  return (
    <section className="calc-siblings">
      <h3>같이 보면 좋은 계산기</h3>
      <div className="calc-list">
        {siblings.map((s) => (
          <Link
            key={s.slug}
            href={`/calc/${encodeURIComponent(s.slug)}`}
            className="calc-card"
          >
            <span className="calc-emoji">{s.emoji}</span>
            <span className="calc-card-body">
              <b>{s.short} 계산기</b>
              <em>{s.desc}</em>
            </span>
          </Link>
        ))}
      </div>
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

function UnemploymentGuide() {
  return (
    <article className="calc-guide">
      <h3>총액을 가르는 건 금액이 아니라 일수다</h3>
      <p>
        실업급여를 검색하면 대부분 &lsquo;하루 얼마&rsquo;까지만 알려준다. 그런데 월급이 어느
        정도 되는 사람은 어차피 <b>상한액에 걸려 하루 금액이 똑같다</b>. 실제로 총액을
        가르는 건 며칠 받느냐다. 위 계산기에서 입사일만 1년 당겨보면 30일이 늘어나
        200만원 가까이 차이가 난다.
      </p>

      <h3>며칠 받는지는 두 가지로 정해진다</h3>
      <p>
        나이(만 50세 기준)와 고용보험 가입기간, 이 두 가지다. 50세 미만은 가입기간에
        따라 120일에서 240일, 50세 이상이거나 장애인이면 120일에서 270일이다.
        가입기간 1년·3년·5년·10년이 경계선이라, 퇴사 시점을 조금 미룰 수 있다면
        이 선을 넘기고 나오는 쪽이 유리하다.
      </p>

      <h3>하루 금액에는 위아래로 벽이 있다</h3>
      <p>
        구직급여일액은 평균임금의 60%인데, 위로는 상한액에서 잘리고 아래로는
        최저임금의 80%(1일 8시간 기준)로 받쳐준다. 상한은 2019년부터 하루 66,000원에
        묶여 있는 반면 하한은 최저임금을 따라 매년 올라와서, 지금은 두 값이
        거의 붙어 있다. 그래서 <b>월급이 얼마든 하루 6만원대 중반에서 크게 벗어나지
        않는다.</b>
      </p>

      <h3>받을 수 있는지부터가 관문이다</h3>
      <p>
        금액보다 먼저 확인할 게 자격이다. 이직 전 18개월 동안 피보험단위기간이
        <b> 180일 이상</b>이어야 하고, 퇴사 사유가 비자발적이어야 한다. 스스로 낸
        사표는 원칙적으로 대상이 아니다. 다만 임금체불, 직장 내 괴롭힘, 통근 곤란,
        질병처럼 정당한 사유로 인정되는 경우가 있으므로 사유가 애매하면 고용센터에
        먼저 물어보는 게 순서다.
      </p>

      <p className="calc-src">
        피보험단위기간은 재직일수와 다르다(무급일은 빠진다). 본인 가입이력은
        고용보험 홈페이지에서 조회할 수 있고, 최종 지급액은 고용센터 결정에 따른다.
      </p>
    </article>
  );
}

function AnnualLeaveGuide() {
  return (
    <article className="calc-guide">
      <h3>1년 미만과 1년 이상은 규칙이 다르다</h3>
      <p>
        입사 첫해에는 <b>1개월 개근할 때마다 1일씩</b> 생긴다. 최대 11일이다.
        그러다 1년을 채우면 여기에 <b>15일이 따로</b> 붙는다. 그래서 입사 1년 시점에
        최대 26일을 쥐게 된다. 이 둘을 하나로 아는 사람이 많아서 첫해 연차를
        손해 보는 경우가 흔하다.
      </p>

      <h3>3년째부터 2년마다 하루씩</h3>
      <p>
        1년 이상이면 15일에서 시작해 3년째에 16일, 5년째에 17일 하는 식으로
        2년마다 1일씩 붙는다. 상한은 <b>25일</b>이고 21년째에 도달한다.
        그 뒤로는 아무리 오래 다녀도 법정 연차가 더 늘지 않는다.
      </p>

      <h3>수당은 월급을 209로 나누는 데서 시작한다</h3>
      <p>
        연차수당은 <b>1일 통상임금 × 남은 연차</b>다. 여기서 1일 통상임금은
        월 통상임금을 <b>209시간</b>으로 나눠 시급을 구한 뒤 8시간을 곱한 값이다.
        209는 주 40시간에 주휴 8시간을 더해 한 달로 환산한 숫자다. 이 209를 모르면
        회사가 준 금액이 맞는지 검산할 수가 없다.
      </p>

      <h3>통상임금에는 월급 말고도 들어가는 게 있다</h3>
      <p>
        정기적·일률적·고정적으로 지급되는 수당은 통상임금에 포함된다. 직책수당,
        기술수당처럼 매달 같은 금액이 나오는 것들이다. 반대로 실적에 따라 달라지는
        성과급이나 연장근로수당은 빠진다. 위 계산기에는 <b>기본급에 고정수당을 더한
        금액</b>을 넣어야 실제와 맞는다.
      </p>

      <h3>안 쓰면 사라질 수도 있다</h3>
      <p>
        회사가 <b>연차사용촉진</b> 절차를 법대로 밟았다면(서면 통보 등) 미사용 연차수당
        지급 의무가 없어진다. 아무 통보도 없었다면 수당으로 청구할 수 있다.
        연차수당 청구권의 소멸시효는 3년이다.
      </p>

      <p className="calc-src">
        상시 5인 미만 사업장에는 연차 규정 자체가 적용되지 않는다.
        회계연도 기준으로 운영하는 회사라도 퇴직 시점에 입사일 기준보다 적으면
        차액을 정산해줘야 한다.
      </p>
    </article>
  );
}

function PensionCreditGuide() {
  return (
    <article className="calc-guide">
      <h3>퇴직금을 IRP로 받은 건 공제 대상이 아니다</h3>
      <p>
        가장 많이 오해하는 지점이다. 퇴직금 5,000만원이 IRP로 들어왔다고 해서
        그 돈으로 세액공제를 받는 게 아니다. 그건 <b>퇴직소득세를 나중으로 미룬 것</b>이고,
        세액공제는 <b>내가 따로 넣은 돈</b>에만 붙는다. 계좌 잔고가 아무리 커도
        올해 추가로 납입한 금액이 기준이다.
      </p>

      <h3>600만원과 900만원, 두 개의 한도</h3>
      <p>
        연금저축만 쓰면 <b>600만원</b>까지다. 여기에 IRP를 더하면 합쳐서 <b>900만원</b>까지
        늘어난다. 그래서 900만원을 채우려면 연금저축 600 + IRP 300처럼 나누거나,
        IRP에만 900만원을 넣어도 된다. 반대로 연금저축에만 900만원을 넣으면
        600만원까지만 인정되고 300만원은 그냥 묶인 돈이 된다.
      </p>

      <h3>총급여 5,500만원 한 줄에 30만원이 걸린다</h3>
      <p>
        공제율은 총급여 5,500만원을 경계로 <b>16.5%와 13.2%</b>로 갈린다.
        900만원을 꽉 채웠을 때 148만원과 119만원, 약 30만원 차이다. 급여가 이 선
        근처라면 비과세 식대 등으로 총급여가 어떻게 잡히는지 확인해볼 값어치가 있다.
      </p>

      <h3>돌려받을 세금이 없으면 넣어도 소용없다</h3>
      <p>
        세액공제는 <b>내야 할 세금을 깎아주는</b> 방식이다. 결정세액이 이미 0인 사람은
        연금저축에 900만원을 넣어도 돌려받을 게 없다. 소득이 적은 해에 무리해서
        채우는 것은 의미가 없다는 뜻이다. 그 해는 건너뛰고 소득이 높은 해에
        채우는 쪽이 낫다.
      </p>

      <h3>중도해지하면 받은 것을 토해낸다</h3>
      <p>
        연금 개시 전에 깨면 그동안 공제받은 금액과 운용수익에 <b>기타소득세 16.5%</b>가
        붙는다. 공제로 받은 만큼 그대로 돌려주는 구조라, 남는 게 없거나 오히려 손해다.
        <b>당장 쓸 돈은 넣지 않는 것</b>이 이 계좌의 첫 번째 규칙이다.
        만 55세 이후 연금으로 받아야 낮은 세율(3.3~5.5%)이 적용된다.
      </p>

      <p className="calc-src">
        근로소득 외 소득이 있으면 총급여가 아니라 종합소득금액(4,500만원)이 기준이 된다.
        ISA 만기자금을 연금계좌로 옮기면 전환금액의 10%(최대 300만원)를 추가로
        공제받을 수 있으며, 위 계산에는 포함하지 않았다.
      </p>
    </article>
  );
}
