import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL || "https://example.com";
  let products: { slug: string; updatedAt: Date }[] = [];
  try {
    products = await getAllSlugs();
  } catch {
    // DB 미연결 시 기본 페이지만
  }
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/deals`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/ranking`, changeFrequency: "daily", priority: 0.8 },
    ...products.map((p) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
