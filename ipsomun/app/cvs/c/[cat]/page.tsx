import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CATEGORIES,
  DEAL_TYPES,
  categoryFromSlug,
  categorySlug,
  monthLabel,
  unitPrice,
  brandName,
  type CvsItem,
  type DealType,
} from "@/lib/cvs";
import { CUR, HAS_DATA, CATEGORY_COUNTS, itemsInCategory } from "@/lib/cvsData";
import CvsBrowser from "@/components/CvsBrowser";
import CvsSubscribe from "@/components/CvsSubscribe";
import { won, jsonLdString } from "@/lib/util";

/**
 * 분류별 4사 통합 페이지 — "편의점 음료 1+1" 같은 검색을 노린다.
 * 같은 분류의 행사를 편의점 구분 없이 1개당 가격이 싼 순으로 보여준다.
 */
export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ cat: categorySlug(c) }));
}

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";
const FIRST = 48;
const M = HAS_DATA ? monthLabel(CUR.month) : "이번 달";

export async function generateMetadata({ params }: { params: Promise<{ cat: string }> }): Promise<Metadata> {
  const c = categoryFromSlug((await params).cat);
  if (!c) return {};
  const url = `${SITE}/cvs/c/${encodeURIComponent(categorySlug(c))}`;
  const title = `${M} 편의점 ${c} 1+1·2+1 — 1개당 최저가 순`;
  return {
    title,
    description: `${M} CU·세븐일레븐·이마트24 ${c} 행사를 한데 모아 1개당 실제 가격이 싼 순서로 정리했습니다. 매월 1일 갱신.`,
    alternates: { canonical: url },
    openGraph: { title: `${title} | 입소문`, url, type: "website", siteName: "입소문", locale: "ko_KR", images: ["/og-default.png"] },
  };
}

export default async function CvsCategoryPage({ params }: { params: Promise<{ cat: string }> }) {
  const c = categoryFromSlug((await params).cat);
  if (!c) notFound();
  const items = itemsInCategory(c);
  const groups = DEAL_TYPES.map((t) => [t, items.filter((x) => x.t === t)] as [DealType, CvsItem[]]).filter(
    ([, v]) => v.length > 0
  );
  const initial = Object.fromEntries(groups.map(([t, v]) => [t, v.slice(0, FIRST)])) as Partial<
    Record<DealType, CvsItem[]>
  >;
  const top = items.filter((x) => x.t !== "덤").slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${M} 편의점 ${c} 행사 1개당 최저가`,
    itemListElement: items.slice(0, 10).map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${brandName(it.b)} ${it.n} ${it.t}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <section className="section">
        <div className="section-head">
          <h1>
            {M} 편의점 {c} 행사
          </h1>
          <span className="sub">{items.length.toLocaleString("ko-KR")}개 · 1개당 싼 순</span>
        </div>
        <nav className="cvs-brand-nav">
          <Link href="/cvs">← 편의점 행사</Link>
          {CATEGORY_COUNTS.filter((x) => x.c !== c && x.count > 0).map((x) => (
            <Link key={x.c} href={`/cvs/c/${encodeURIComponent(x.slug)}`}>
              {x.c}
            </Link>
          ))}
        </nav>
        {top.length > 0 && (
          <p className="cvs-patch-lead">
            이번 달 {c} 중 1개당 가장 싼 행사는{" "}
            {top.map((it, i) => (
              <span key={i}>
                {i > 0 && ", "}
                <b>
                  {brandName(it.b)} {it.n}
                </b>
                ({it.t}, 1개당 {won(unitPrice(it))})
              </span>
            ))}
            입니다. 같은 상품이라도 편의점마다 행사 조건이 달라 1개당 가격으로 비교했습니다.
          </p>
        )}
      </section>
      {groups.length === 0 ? (
        <div className="empty">이번 달 {c} 행사가 없습니다.</div>
      ) : (
        <CvsBrowser
          dataUrl={`/cvs/data/c/${encodeURIComponent(categorySlug(c))}`}
          tabs={groups.map(([t, v]) => ({ t, count: v.length }))}
          initial={initial}
          showBrand
        />
      )}
      <CvsSubscribe place="category" />
    </>
  );
}
