import Link from "next/link";
import Image from "next/image";
import {
  won,
  discountRate,
  imgUrl,
  pickPrimary,
  platformColor,
  platformName,
} from "@/lib/util";
import FavButton from "./FavButton";
import Stars from "./Stars";

export interface CardLink {
  id: string;
  platform: string;
  price: number | null;
}

export interface CardProduct {
  slug: string;
  title: string;
  imageUrl: string;
  price: number | null;
  originalPrice: number | null;
  isDeal: boolean;
  category: string;
  rating?: number | null;
  ratingCount?: number | null;
  /** 있으면 카드에서 바로 가격비교·구매까지 간다 (없으면 기존 그대로 2클릭) */
  links?: CardLink[];
}

export default function ProductCard({
  p,
  rank,
}: {
  p: CardProduct;
  rank?: number;
}) {
  // 상세 페이지와 같은 규칙(pickPrimary)으로 대표 링크·대표가를 고른다.
  // 카드만 다른 규칙을 쓰면 목록의 가격과 상세의 큰 글씨 가격이 어긋난다.
  const links = p.links ?? [];
  const { ordered, primary, lowest, priceOf } = pickPrimary(links, p.price);
  const primaryPrice = primary ? priceOf(primary) : null;
  const displayPrice = primaryPrice ?? p.price;
  const dc = discountRate(displayPrice, p.originalPrice);

  // 가격을 아는 링크가 2개 이상일 때만 비교 줄을 보여준다 (한쪽만 알면 비교가 아니다)
  const priced = ordered
    .map((l) => ({ l, price: priceOf(l) }))
    .filter((x): x is { l: CardLink; price: number } => x.price != null);
  const showCompare = priced.length >= 2;

  return (
    <div className="card">
      {rank ? (
        <span className="badge rank">{rank}위</span>
      ) : p.isDeal ? (
        <span className="badge">오늘의 딜</span>
      ) : null}
      <FavButton slug={p.slug} />
      <Link href={`/p/${p.slug}`} className="card-hit">
        <div className="thumb">
          {p.imageUrl ? (
            <Image
              src={imgUrl(p.imageUrl, 400)}
              alt={p.title}
              fill
              sizes="(max-width: 640px) 50vw, 220px"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <span className="noimg">🛍️</span>
          )}
        </div>
        <div className="body">
          <div className="title">{p.title}</div>
          <div className="meta">{p.category}</div>
          {p.rating != null && p.rating > 0 && (
            <Stars rating={p.rating} count={p.ratingCount} />
          )}
          <div className="price-row">
            {dc && <span className="discount">{dc}%</span>}
            {displayPrice != null && (
              <span className="price">{won(displayPrice)}</span>
            )}
            {dc && <span className="original">{won(p.originalPrice)}</span>}
          </div>
          {showCompare && (
            <div className="card-vs">
              {priced.slice(0, 3).map(({ l, price }) => (
                <span
                  key={l.id}
                  className={`vs-chip${price === lowest ? " win" : ""}`}
                >
                  <em>{platformName(l.platform)}</em>
                  {won(price)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
      {primary && (
        <a
          href={`/go/${primary.id}`}
          className="card-buy"
          style={{ background: platformColor(primary.platform) }}
          rel="nofollow sponsored noopener"
          target="_blank"
        >
          {platformName(primary.platform)}에서 구매
          {showCompare && primaryPrice === lowest && (
            <b className="chip">최저가</b>
          )}
          <small>→</small>
        </a>
      )}
    </div>
  );
}
