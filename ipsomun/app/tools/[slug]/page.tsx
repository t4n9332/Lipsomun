import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { TOOLS, getTool } from "@/lib/tools";
import PdfMergeTool from "@/components/tools/PdfMergeTool";
import AdSlot from "@/components/AdSlot";

export const revalidate = 86400;

/** 새 도구는 여기 한 줄 + 컴포넌트 + lib/tools.ts 한 줄이면 붙는다 */
const REGISTRY: Record<
  string,
  { Tool: React.ComponentType; Guide: React.ComponentType }
> = {
  PDF합치기: { Tool: PdfMergeTool, Guide: PdfMergeGuide },
};

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = getTool(slug);
  if (!t) return {};
  return {
    title: t.title,
    description: t.desc,
    keywords: t.keywords,
    alternates: { canonical: "/tools/" + encodeURIComponent(t.slug) },
    openGraph: { title: t.title, description: t.desc },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = getTool(slug);
  if (!t) notFound();

  const entry = REGISTRY[t.slug];
  if (!entry) notFound();
  const { Tool, Guide } = entry;

  return (
    <section className="section">
      <div className="section-head">
        <h2>
          {t.emoji} {t.short}
        </h2>
        <span className="sub">{t.desc}</span>
      </div>

      <Tool />

      <AdSlot slot="1234567890" />

      <Guide />

      <nav className="calc-bridge">
        <b>입소문에서 이어서 보기</b>
        <span className="calc-bridge-links">
          <Link href="/calc">생활 계산기</Link>
          <Link href="/compare">가격비교</Link>
          <Link href="/deals">오늘의 딜</Link>
          <Link href="/blog">리포트</Link>
        </span>
      </nav>

      <p className="calc-back">
        <Link href="/tools">← 다른 도구 보기</Link>
      </p>
    </section>
  );
}

/** 도구만 덩그러니 있으면 애드센스가 '가치 있는 콘텐츠 없음'으로 본다. */
function PdfMergeGuide() {
  return (
    <article className="calc-guide">
      <h3>왜 파일을 올리지 않아도 되나</h3>
      <p>
        PDF를 합치는 일은 계산이 무거운 작업이 아니다. 페이지를 복사해 새 문서에
        붙이는 것에 가깝다. 요즘 브라우저는 이 정도를 혼자 처리한다. 그런데도 대부분의
        서비스가 파일을 서버로 올려 받는 것은, 그렇게 만드는 편이 쉽고 그 과정에서
        회원가입과 유료 전환을 걸 수 있기 때문이다. 기술적으로 필요해서가 아니다.
      </p>

      <h3>올리지 않으면 좋은 점 세 가지</h3>
      <p>
        <b>첫째, 용량 제한이 없다.</b> 업로드가 없으니 서버가 받을 수 있는 크기라는
        개념 자체가 없다. 이 컴퓨터의 메모리가 감당하는 만큼 된다.
        <br />
        <b>둘째, 빠르다.</b> 올리고 기다리고 다시 받는 왕복이 통째로 사라진다.
        보통 몇 초 안에 끝난다.
        <br />
        <b>셋째, 문서가 밖으로 나가지 않는다.</b> 계약서, 급여명세서, 진단서 같은
        것을 다룰 때 이게 가장 중요하다.
      </p>

      <h3>순서가 곧 결과다</h3>
      <p>
        합쳐진 문서는 위 목록의 <b>위에서부터 아래 순서</b>로 이어붙는다. 화살표
        버튼으로 순서를 바꾼 뒤 합치면 된다. 파일 이름이 &lsquo;1, 2, 10&rsquo;처럼 되어
        있으면 컴퓨터가 10을 2보다 앞에 놓는 경우가 있으니, 합치기 전에 목록의
        순서를 한 번 확인하는 게 안전하다.
      </p>

      <h3>암호가 걸린 파일은 합쳐지지 않는다</h3>
      <p>
        열 때 비밀번호를 묻는 PDF는 목록에 빨갛게 표시된다. 이런 파일은 먼저 암호를
        풀어야 한다. 은행이나 카드사에서 받은 명세서가 대부분 여기에 해당한다.
        PDF 뷰어에서 열어 <b>인쇄 → PDF로 저장</b>을 하면 암호가 없는 사본이 만들어진다.
      </p>

      <h3>합친 뒤에 용량이 커졌다면</h3>
      <p>
        각 문서가 쓰던 글꼴이 그대로 따라오기 때문에 단순 합계보다 커질 수 있다.
        이럴 때는 PDF 뷰어에서 다시 <b>인쇄 → PDF로 저장</b>을 하면 정리되면서
        줄어드는 경우가 많다. 다만 이 과정에서 문서 안의 검색 가능한 텍스트나
        책갈피가 사라질 수 있으니, 보관용 원본은 따로 남겨두는 편이 좋다.
      </p>

      <p className="calc-src">
        이 도구는 사용자의 브라우저에서만 동작한다. 파일을 전송하지 않으므로
        서버에 기록이 남지 않고, 만든 사람도 어떤 파일을 다뤘는지 알 수 없다.
      </p>
    </article>
  );
}
