import Link from "next/link";
import { getDeals, getPopular, getRecentReviewed } from "@/lib/db";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [deals, popular, recent] = await Promise.all([
    getDeals(8),
    getPopular(5),
    getRecentReviewed(4),
  ]);

  return (
    <>
      <section className="hero">
        <h1>
          진짜 써본 사람들의 <em>입소문</em>
        </h1>
        <p>
          오늘의 특가, 카테고리별 인기 랭킹, 솔직 리뷰까지 — 사기 전에 여기서
          먼저 확인하세요.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>🔥 오늘의 딜</h2>
          <span className="sub">매일 갱신되는 특가 모음</span>
          <Link className="more" href="/deals">
            전체보기 →
          </Link>
        </div>
        {deals.length === 0 ? (
          <div className="empty">
            아직 등록된 딜이 없습니다. 곧 특가 소식으로 찾아올게요!
          </div>
        ) : (
          <div className="grid">
            {deals.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>🏆 지금 인기 랭킹</h2>
          <span className="sub">방문자들이 가장 많이 찾은 제품</span>
          <Link className="more" href="/ranking">
            전체보기 →
          </Link>
        </div>
        {popular.length === 0 ? (
          <div className="empty">데이터가 쌓이는 중입니다.</div>
        ) : (
          <div className="rank-list">
            {popular.map((p, i) => (
              <Link key={p.id} href={`/p/${p.slug}`} className="rank-item">
                <span className="rank-num">{i + 1}</span>
                <span className="thumb">
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.title} loading="lazy" />
                  )}
                </span>
                <span className="info">
                  <span className="title">{p.title}</span>
                  {p.price != null && (
                    <div className="price">{p.price.toLocaleString()}원</div>
                  )}
                </span>
                <span className="clicks">조회 {p.views + p.clicks}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>✍️ 최신 리뷰</h2>
          <span className="sub">직접 정리한 솔직 사용기</span>
        </div>
        {recent.length === 0 ? (
          <div className="empty">첫 리뷰를 준비하고 있어요.</div>
        ) : (
          <div className="grid">
            {recent.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
