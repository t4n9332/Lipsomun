import Link from "next/link";
import Image from "next/image";
import {
  getDeals,
  getPopular,
  getRecentReviewed,
  getPublishedCollections,
  getPriceCompareProducts,
} from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import CompareCard, { comparePrices } from "@/components/CompareCard";
import { TELEGRAM_CHANNEL_URL, imgUrl } from "@/lib/util";

export const revalidate = 300; // 홈 — 딜·가격 자주 변동

export default async function Home() {
  const [deals, popular, recent, picks, compareRaw] = await Promise.all([
    getDeals(8),
    getPopular(5),
    getRecentReviewed(4),
    getPublishedCollections(4).catch(() => []),
    getPriceCompareProducts(40).catch(() => []),
  ]);
  // 절약액(두 플랫폼 가격차) 큰 순으로 상단 노출
  const compare = compareRaw
    .sort((a, b) => comparePrices(b).savings - comparePrices(a).savings)
    .slice(0, 8);

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

      {compare.length > 0 && (
        <section className="vs-section">
          <div className="section-head">
            <h2>🆚 쿠팡 vs 토스 가격비교</h2>
            <span className="sub">같은 상품, 어디가 더 쌀까? 매일 자동 비교</span>
            <Link className="more" href="/compare">
              전체보기 →
            </Link>
          </div>
          <div className="vs-grid">
            {compare.map((p) => (
              <CompareCard key={p.id} p={p} />
            ))}
          </div>
          <p className="vs-note">
            ※ 쿠폰 보유에 따라 가격 변동이 있습니다. 이 콘텐츠는 토스쇼핑
            쉐어링크 활동의 일환으로, 링크를 통한 구매가 발생하면 일정 수수료를
            지급받습니다.
          </p>
        </section>
      )}

      <a
        href={TELEGRAM_CHANNEL_URL}
        target="_blank"
        rel="noopener"
        className="tg-banner"
      >
        <span className="tg-icon">📣</span>
        <span className="tg-text">
          <b>매일 아침·저녁, 특가 브리핑을 텔레그램으로</b>
          <span>역대 최저가 · 쿠팡 vs 토스 가격차 TOP을 무료로 받아보세요</span>
        </span>
        <span className="tg-cta">무료 구독 →</span>
      </a>

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
                    <Image
                      src={imgUrl(p.imageUrl, 160)}
                      alt={p.title}
                      fill
                      sizes="64px"
                      style={{ objectFit: "cover" }}
                    />
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

      {picks.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>🧺 기획전</h2>
            <span className="sub">주제별로 골라 담은 추천 모음</span>
            <Link className="more" href="/pick">
              전체보기 →
            </Link>
          </div>
          <div className="pick-grid">
            {picks.map((c) => (
              <Link key={c.id} href={`/pick/${c.slug}`} className="pick-card">
                <span className="pick-thumbs">
                  {c.images.slice(0, 4).map((img, i) => (
                    <span key={i} className="pt">
                      <Image src={imgUrl(img, 200)} alt="" fill sizes="80px" style={{ objectFit: "cover" }} />
                    </span>
                  ))}
                </span>
                <span className="pick-info">
                  <b>{c.title}</b>
                  {c.description && <span className="d">{c.description}</span>}
                  <span className="n">{c.itemCount}개 제품</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
