import type { Metadata } from "next";
import { getByCategory } from "@/lib/db";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";
const TOP = 33;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const category = decodeURIComponent(name);
  const url = `${SITE}/category/${encodeURIComponent(category)}`;
  return {
    title: `${category} 인기 TOP ${TOP}`,
    description: `${category} 카테고리에서 입소문이 엄선한 인기 제품 TOP ${TOP}. 실구매 데이터 기반 랭킹과 최저가 링크를 확인하세요.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${category} 인기 TOP ${TOP} | 입소문`,
      url,
      type: "website",
      siteName: "입소문",
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const category = decodeURIComponent(name);
  const items = await getByCategory(category, TOP);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${category} 인기 TOP ${TOP}`,
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.title,
      url: `${SITE}/p/${p.slug}`,
    })),
  };

  return (
    <section className="section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="section-head">
        <h2>
          {category} TOP {items.length >= TOP ? TOP : items.length}
        </h2>
        <span className="sub">입소문이 엄선한 인기 제품 랭킹</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">이 카테고리에는 아직 제품이 없습니다.</div>
      ) : (
        <div className="grid">
          {items.map((p, i) => (
            <ProductCard key={p.id} p={p} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
