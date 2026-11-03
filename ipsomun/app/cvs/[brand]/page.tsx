import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRANDS, DEAL_TYPES, brandName, isBrand, monthLabel, type CvsItem } from "@/lib/cvs";
import { CUR, HAS_DATA } from "@/lib/cvsData";
import CvsCard from "@/components/CvsCard";
import CvsSearch from "@/components/CvsSearch";
import FarmTabs from "@/components/FarmTabs";

export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return BRANDS.map((b) => ({ brand: b.id }));
}

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  if (!isBrand(brand)) return {};
  const name = brandName(brand);
  const M = HAS_DATA ? monthLabel(CUR.month) : "이번 달";
  return {
    title: `${M} ${name} 행사상품 1+1·2+1 전체 목록`,
    description: `${M} ${name} 1+1·2+1 행사상품 전체를 1개당 가격과 함께 정리했습니다. 상품 이름으로 바로 찾아보세요. 매월 1일 갱신.`,
    alternates: { canonical: `${SITE}/cvs/${brand}` },
    openGraph: {
      title: `${M} ${name} 행사상품 | 입소문`,
      url: `${SITE}/cvs/${brand}`,
      type: "website",
      siteName: "입소문",
      locale: "ko_KR",
      images: ["/og-default.png"],
    },
  };
}

export default async function CvsBrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  if (!isBrand(brand)) notFound();
  const name = brandName(brand);
  const items = CUR.items.filter((x) => x.b === brand);
  const groups = DEAL_TYPES.map((t) => [t, items.filter((x) => x.t === t)] as [string, CvsItem[]]).filter(
    ([, v]) => v.length > 0
  );

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h1>
            {HAS_DATA ? monthLabel(CUR.month) : "이번 달"} {name} 행사상품
          </h1>
          <span className="sub">{items.length.toLocaleString("ko-KR")}개</span>
        </div>
        <nav className="cvs-brand-nav">
          <Link href="/cvs">← 4사 비교</Link>
          {BRANDS.filter((b) => b.id !== brand).map((b) => (
            <Link key={b.id} href={`/cvs/${b.id}`}>
              {b.name}
            </Link>
          ))}
        </nav>
        {CUR.stale?.includes(brand) && (
          <p className="notice">이번 달 {name} 데이터 갱신이 늦어져 지난달 목록을 보여드리고 있어요.</p>
        )}
      </section>

      {groups.length === 0 ? (
        <div className="empty">매월 1일 아침에 행사상품을 모아 올립니다.</div>
      ) : (
        <div id="cvs-list">
          <CvsSearch target="cvs-list" />
          <FarmTabs tabs={groups.map(([cat, list]) => ({ cat, count: list.length }))}>
            {groups.map(([cat, list], i) => (
              <section className="section farm-panel" key={cat} id={cat} role="tabpanel" hidden={i !== 0}>
                <div className="grid cvs-grid">
                  {list.map((it, k) => (
                    <CvsCard key={k} it={it} />
                  ))}
                </div>
              </section>
            ))}
          </FarmTabs>
        </div>
      )}
    </>
  );
}
