import type { MetadataRoute } from "next";
import { getAllSlugs, getAllCollectionSlugs } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL || "https://example.com";
  let products: { slug: string; updatedAt: Date }[] = [];
  let picks: { slug: string; updatedAt: Date }[] = [];
  try {
    [products, picks] = await Promise.all([
      getAllSlugs(),
      getAllCollectionSlugs(),
    ]);
  } catch {
    // DB 미연결 시 기본 페이지만
  }
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/compare`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/deals`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/ranking`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/pick`, changeFrequency: "weekly", priority: 0.8 },
    ...picks.map((c) => ({
      url: `${base}/pick/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
