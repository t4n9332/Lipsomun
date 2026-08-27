import Link from "next/link";
import Image from "next/image";
import { won, discountRate, imgUrl } from "@/lib/util";
import FavButton from "./FavButton";
import Stars from "./Stars";

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
          {p.price != null && <span className="price">{won(p.price)}</span>}
          {dc && <span className="original">{won(p.originalPrice)}</span>}
        </div>
      </div>
    </Link>
  );
}
