import Link from "next/link";
import { won, discountRate } from "@/lib/util";
import FavButton from "./FavButton";

export interface CardProduct {
  slug: string;
  title: string;
  imageUrl: string;
  price: number | null;
  originalPrice: number | null;
  isDeal: boolean;
  category: string;
}

export default function ProductCard({
  p,
  rank,
}: {
  p: CardProduct;
  rank?: number;
}) {
  const dc = discountRate(p.price, p.originalPrice);
  return (
    <Link href={`/p/${p.slug}`} className="card">
      {rank ? (
        <span className="badge rank">{rank}위</span>
      ) : p.isDeal ? (
        <span className="badge">오늘의 딜</span>
      ) : null}
      <FavButton slug={p.slug} />
      <div className="thumb">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={p.title} loading="lazy" />
        ) : (
          <span className="noimg">🛍️</span>
        )}
      </div>
      <div className="body">
        <div className="title">{p.title}</div>
        <div className="meta">{p.category}</div>
        <div className="price-row">
          {dc && <span className="discount">{dc}%</span>}
          {p.price != null && <span className="price">{won(p.price)}</span>}
          {dc && <span className="original">{won(p.originalPrice)}</span>}
        </div>
      </div>
    </Link>
  );
}
