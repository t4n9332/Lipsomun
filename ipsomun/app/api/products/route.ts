import { NextResponse } from "next/server";
import { getBySlugs } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slugs = (url.searchParams.get("slugs") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (slugs.length === 0) return NextResponse.json({ products: [] });

  const rows = await getBySlugs(slugs);
  const products = rows.map((p) => ({
    slug: p.slug,
    title: p.title,
    imageUrl: p.imageUrl,
    price: p.price,
    originalPrice: p.originalPrice,
    isDeal: p.isDeal,
    category: p.category,
  }));
  return NextResponse.json({ products });
}
