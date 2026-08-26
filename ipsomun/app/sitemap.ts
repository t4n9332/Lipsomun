import type { MetadataRoute } from "next";
import { getAllSlugs, getAllCollectionSlugs, getAllPostSlugs } from "@/lib/db";
import { CATEGORIES } from "@/lib/util";
import { CALCULATORS } from "@/lib/calculators";

export const revalidate = 1800; // 사이트맵

/**
 * 사이트맵 규격은 URL을 퍼센트 인코딩하도록 요구한다. 슬러그가 한글이라
 * 인코딩하지 않으면 원문 그대로 실리고, 그 형태로 요청하면 400이 난다
 * (브라우저는 자동 인코딩하지만 크롤러·도구는 그렇지 않을 수 있다).
 */
const enc = (slug: string) => encodeURIComponent(slug);

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
    { url: `${base}/calc`, changeFrequency: "monthly", priority: 0.8 },
    ...CALCULATORS.map((c) => ({
      url: `${base}/calc/${encodeURIComponent(c.slug)}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // '기타'는 게시 상품 0개 유지가 원칙이라 빈 페이지 색인을 막기 위해 제외
    ...CATEGORIES.filter((c) => c !== "기타").map((c) => ({
      url: `${base}/category/${encodeURIComponent(c)}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...posts.map((p) => ({
      url: `${base}/blog/${enc(p.slug)}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...picks.map((c) => ({
      url: `${base}/pick/${enc(c.slug)}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${base}/p/${enc(p.slug)}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
