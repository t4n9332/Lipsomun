import Link from "next/link";
import Image from "next/image";
import { won, imgUrl } from "@/lib/util";
import type { ProductWithLinks } from "@/lib/db";
import Stars from "./Stars";

/** 쿠팡·토스 가격을 나란히 보여주는 가격비교 카드 */
export interface ComparePrices {
  coupang: number | null;
  toss: number | null;
  savings: number; // 두 가격 차이 (비교 불가면 0)
}

export function comparePrices(p: ProductWithLinks): ComparePrices {
  const coupangLink = p.links.find((l) => l.platform === "coupang");
  const tossLink = p.links.find((l) => l.platform === "toss");
  const coupang = coupangLink ? (coupangLink.price ?? p.price) : null;
  const toss = tossLink ? tossLink.price : null;
  const savings = coupang != null && toss != null ? Math.abs(coupang - toss) : 0;
  return { coupang, toss, savings };
}

export default function CompareCard({ p }: { p: ProductWithLinks }) {
  const { coupang, toss, savings } = comparePrices(p);
  const cheaper =
    coupang != null && toss != null && coupang !== toss
      ? coupang < toss
        ? "coupang"
        : "toss"
      : null;

  return (
    <Link href={`/p/${p.slug}`} className="vs-card">
      <span className="vs-thumb">
        {p.imageUrl ? (
          <Image
            src={imgUrl(p.imageUrl, 400)}
            alt={p.title}
            fill
            sizes="(max-width: 600px) 40vw, 180px"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <span className="noimg">🛍️</span>
        )}
        {cheaper && savings > 0 && (
          <span className={`vs-save ${cheaper}`}>
            {cheaper === "toss" ? "토스가" : "쿠팡이"} {won(savings)} 저렴
          </span>
        )}
      </span>
      <span className="vs-body">
        <span className="vs-title">{p.title}</span>
        {p.rating != null && p.rating > 0 && (
          <Stars rating={p.rating} count={p.ratingCount} size={12} />
        )}
        <span className={`vs-price coupang${cheaper === "coupang" ? " win" : ""}`}>
          <em>쿠팡</em>
          {coupang != null ? won(coupang) : "—"}
          {cheaper === "coupang" && <b className="chip">최저가</b>}
        </span>
        <span className={`vs-price toss${cheaper === "toss" ? " win" : ""}`}>
          <em>토스</em>
          {toss != null ? won(toss) : "—"}
          {cheaper === "toss" && <b className="chip">최저가</b>}
        </span>
      </span>
    </Link>
  );
}
