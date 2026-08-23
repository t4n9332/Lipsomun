import { notFound } from "next/navigation";
import { getBySlug, getRelated, incrementViews } from "@/lib/db";
import { won, discountRate, platformName, platformColor } from "@/lib/util";
import ProductCard from "@/components/ProductCard";
import FavButton from "@/components/FavButton";
import ShareButton from "@/components/ShareButton";
import Stars from "@/components/Stars";

export const dynamic = "force-dynamic";

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

  const related = await getRelated(product.category, product.id, 4);

  const dc = discountRate(product.price, product.originalPrice);

  return (
    <>
      <div className="detail">
        <div className="photo">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.title} />
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
          </div>
          <div className="buy-buttons">
            {(() => {
              const priced = product.links.filter((l) => l.price != null);
              const lowest =
                priced.length >= 2
                  ? Math.min(...priced.map((l) => l.price as number))
                  : null;
              return product.links.map((l) => (
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
                  {l.price != null && (
                    <span className="link-price">{won(l.price)}</span>
                  )}
                  {lowest != null && l.price === lowest && (
                    <span className="lowest-chip">최저가</span>
                  )}
                  <small>→</small>
                </a>
              ));
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
