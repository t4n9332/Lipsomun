import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCollectionBySlug } from "@/lib/db";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const col = await getCollectionBySlug(decodeURIComponent(slug)).catch(() => null);
  if (!col) return { title: "기획전을 찾을 수 없어요" };
  const url = `${SITE}/pick/${col.slug}`;
  const desc =
    col.description ||
    `${col.title} — 입소문이 골라 담은 추천 제품 ${col.products.length}개`;
  return {
    title: col.title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: col.title,
      description: desc,
      url,
      type: "website",
      siteName: "입소문",
      images: col.products.find((p) => p.imageUrl)?.imageUrl
        ? [{ url: col.products.find((p) => p.imageUrl)!.imageUrl }]
        : undefined,
    },
  };
}

export default async function PickPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const col = await getCollectionBySlug(decodeURIComponent(slug));
  if (!col) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: col.title,
    description: col.description || undefined,
    itemListElement: col.products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.title,
      url: `${SITE}/p/${p.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="hero pick-hero">
        <h1>
          🧺 <em>{col.title}</em>
        </h1>
        {col.description && <p>{col.description}</p>}
      </section>
      <section className="section">
        {col.products.length === 0 ? (
          <div className="empty">제품을 담는 중이에요. 곧 공개할게요!</div>
        ) : (
          <div className="grid">
            {col.products.map((p, i) => (
              <ProductCard key={p.id} p={p} rank={i + 1} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
