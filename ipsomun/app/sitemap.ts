import type { MetadataRoute } from "next";
import { getAllSlugs, getAllCollectionSlugs, getAllPostSlugs } from "@/lib/db";
import { CATEGORIES } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL || "https://example.com";
  let products: { slug: string; updatedAt: Date }[] = [];
  let picks: { slug: string; updatedAt: Date }[] = [];
  let posts: { slug: string; updatedAt: Date }[] = [];
  try {
    [products, picks, posts] = await Promise.all([
      getAllSlugs(),
      getAllCollectionSlugs(),
      getAllPostSlugs(),
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
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8 },
    // '기타'는 게시 상품 0개 유지가 원칙이라 빈 페이지 색인을 막기 위해 제외
    ...CATEGORIES.filter((c) => c !== "기타").map((c) => ({
      url: `${base}/category/${encodeURIComponent(c)}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
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
