import { NextResponse } from "next/server";
import { getBySlugs, withLinks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slugs = (url.searchParams.get("slugs") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (slugs.length === 0) return NextResponse.json({ products: [] });

  // 찜 목록도 카드에서 바로 가격비교·구매가 되도록 링크를 함께 내려준다
  const rows = await withLinks(await getBySlugs(slugs));
  const products = rows.map((p) => ({
    slug: p.slug,
    title: p.title,
    imageUrl: p.imageUrl,
    price: p.price,
    originalPrice: p.originalPrice,
    isDeal: p.isDeal,
    category: p.category,
    rating: p.rating,
    ratingCount: p.ratingCount,
    links: p.links.map((l) => ({ id: l.id, platform: l.platform, price: l.price })),
  }));
  return NextResponse.json({ products });
}
