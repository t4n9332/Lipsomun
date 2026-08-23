import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import {
  getBySlug,
  getRelated,
  incrementViews,
  getPriceHistory,
  getPriceStats,
} from "@/lib/db";
import { won, discountRate, platformName, platformColor } from "@/lib/util";
import ProductCard from "@/components/ProductCard";
import FavButton from "@/components/FavButton";
import ShareButton from "@/components/ShareButton";
import Stars from "@/components/Stars";
import PriceHistoryChart from "@/components/PriceHistoryChart";

export const dynamic = "force-dynamic";

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getBySlug(decodeURIComponent(slug)).catch(() => null);
  if (!product || !product.isPublished) return { title: "제품을 찾을 수 없어요" };

  const desc =
    (product.review || product.description || "").slice(0, 150) ||
    `${product.title} 최저가 비교와 솔직 리뷰를 입소문에서 확인하세요.`;
  const url = `${SITE}/p/${product.slug}`;

  return {
    title: product.title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: product.title,
      description: desc,
      url,
      type: "website",
      siteName: "입소문",
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description: desc,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getBySlug(decodeURIComponent(slug));
  if (!product || !product.isPublished) notFound();

  // 조회수 증가 (실패 무시)
  incrementViews(product.id).catch(() => {});

  const [related, history, priceStats] = await Promise.all([
    getRelated(product.category, product.id, 4),
    getPriceHistory(product.id).catch(() => []),
    getPriceStats(product.id).catch(() => null),
  ]);

  const dc = discountRate(product.price, product.originalPrice);
  const isAllTimeLow =
    product.price != null &&
    priceStats != null &&
    priceStats.days >= 2 &&
    product.price <= priceStats.minPrice;

  // 구조화 데이터 (구글 리치 결과용)
  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      image: product.imageUrl || undefined,
      description:
        product.review || product.description || product.title,
      category: product.category,
      ...(product.price != null
        ? {
            offers: {
              "@type": "Offer",
              price: product.price,
              priceCurrency: "KRW",
              availability: "https://schema.org/InStock",
              url: `${SITE}/p/${product.slug}`,
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: SITE },
        {
          "@type": "ListItem",
          position: 2,
          name: product.category,
          item: `${SITE}/category/${encodeURIComponent(product.category)}`,
        },
        { "@type": "ListItem", position: 3, name: product.title },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="detail">
        <div className="photo">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              sizes="(max-width: 760px) 100vw, 520px"
              style={{ objectFit: "contain" }}
              priority
            />
          ) : (
            <span style={{ fontSize: 60, opacity: 0.2 }}>🛍️</span>
          )}
        </div>
        <div>
          <div className="cat">{product.category}</div>
          <h1>{product.title}</h1>
          {product.rating != null && product.rating > 0 && (
            <div style={{ margin: "2px 0 6px" }}>
              <Stars rating={product.rating} count={product.ratingCount} size={16} />
            </div>
          )}
          {product.description && (
            <p style={{ color: "#55524d", fontSize: 15 }}>
              {product.description}
            </p>
          )}
          <div className="price-block">
            {dc && <span className="discount">{dc}%</span>}
            {product.price != null && (
              <span className="price">{won(product.price)}</span>
            )}
            {dc && <span className="original">{won(product.originalPrice)}</span>}
            {isAllTimeLow && <span className="low-badge">역대 최저가</span>}
          </div>
          <div className="buy-buttons">
            {(() => {
              // 쿠팡 링크에 개별 가격이 없으면 상품 가격(쿠팡에서 가져온 값)을 사용해 비교
              const effPrice = (l: (typeof product.links)[number]) =>
                l.price ?? (l.platform === "coupang" ? product.price : null);
              const priced = product.links
                .map(effPrice)
                .filter((p): p is number => p != null);
              const lowest = priced.length >= 2 ? Math.min(...priced) : null;
              return product.links.map((l) => {
                const p = effPrice(l);
                return (
                  <a
                    key={l.id}
                    href={`/go/${l.id}`}
                    className="buy-btn"
                    style={{ background: platformColor(l.platform) }}
                    rel="nofollow sponsored"
                  >
                    {l.platform === "etc"
                      ? "판매처에서 보기"
                      : `${platformName(l.platform)}에서 구매`}
                    {p != null && <span className="link-price">{won(p)}</span>}
                    {lowest != null && p === lowest && (
                      <span className="lowest-chip">최저가</span>
                    )}
                    <small>→</small>
                  </a>
                );
              });
            })()}
            {product.links.length === 0 && (
              <div className="empty" style={{ padding: "20px 0" }}>
                구매 링크 준비 중입니다.
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <FavButton slug={product.slug} big />
              <ShareButton title={product.title} />
            </div>
            {(product.review || product.pros || product.cons) && (
              <a href="#review" className="review-jump">
                ✍️ 입소문 리뷰 바로 보기 ↓
              </a>
            )}
          </div>
          <div className="disclosure">
            이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
            수수료를 제공받습니다. 다른 플랫폼 링크 역시 제휴 링크일 수
            있으며, 구매자에게 추가 비용은 발생하지 않습니다.
          </div>
        </div>
      </div>

      <PriceHistoryChart history={history} isAllTimeLow={isAllTimeLow} />

      {(product.review || product.pros || product.cons) && (
        <div className="review-box" id="review">
          <h2>✍️ 입소문 리뷰</h2>
          {product.review && <div className="content">{product.review}</div>}
          {(product.pros || product.cons) && (
            <div className="pros-cons">
              {product.pros && (
                <div className="col pros">
                  <b>👍 이런 점이 좋아요</b>
                  {product.pros}
                </div>
              )}
              {product.cons && (
                <div className="col cons">
                  <b>👎 이런 점은 아쉬워요</b>
                  {product.cons}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>함께 많이 본 제품</h2>
          </div>
          <div className="grid">
            {related.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
