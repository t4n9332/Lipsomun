import type { MetadataRoute } from "next";
import { getAllSlugs, getAllCollectionSlugs, getAllPostSlugs } from "@/lib/db";
import { CATEGORIES } from "@/lib/util";
import { CALCULATORS } from "@/lib/calculators";
import { TOOLS } from "@/lib/tools";

export const revalidate = 1800; // 사이트맵

/**
 * 사이트맵 규격은 URL을 퍼센트 인코딩하도록 요구한다. 슬러그가 한글이라
 * 인코딩하지 않으면 원문 그대로 실리고, 그 형태로 요청하면 400이 난다
 * (브라우저는 자동 인코딩하지만 크롤러·도구는 그렇지 않을 수 있다).
 */
const enc = (slug: string) => encodeURIComponent(slug);

/**
 * IndexNow(scripts/indexnow.mjs)는 sitemap의 <lastmod> 값이 바뀐 URL만 재제출한다.
 * 허브 페이지에 lastModified가 없으면 값이 늘 빈 문자열이라 "" === ""이 되어
 * 최초 1회 제출 뒤 영영 재제출되지 않는다 — 홈·기획전·카테고리 16개가 그 상태였다
 * (2026-09-02 확인. 제품·블로그 852개는 updatedAt이 있어 정상 동작 중이었다).
 *
 * 다만 매 요청마다 값이 흔들리면 하루 8회차마다 같은 URL을 재제출하게 되므로
 * 한국시간 자정 기준으로 하루 한 번만 바뀌도록 끊는다.
 * calc·tools처럼 내용이 코드와 함께만 바뀌는 페이지는 일부러 빼뒀다 —
 * 그쪽은 최초 1회 제출로 충분하다.
 */
function kstToday(): Date {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

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
  const today = kstToday();
  return [
    { url: base, lastModified: today, changeFrequency: "daily", priority: 1 },
    { url: `${base}/compare`, lastModified: today, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/deals`, lastModified: today, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/ranking`, lastModified: today, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/pick`, lastModified: today, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/farm`, lastModified: today, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/blog`, lastModified: today, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/calc`, changeFrequency: "monthly", priority: 0.8 },
    ...CALCULATORS.map((c) => ({
      url: `${base}/calc/${encodeURIComponent(c.slug)}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${base}/tools`, changeFrequency: "monthly" as const, priority: 0.8 },
    ...TOOLS.map((t) => ({
      url: `${base}/tools/${encodeURIComponent(t.slug)}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // '기타'는 게시 상품 0개 유지가 원칙이라 빈 페이지 색인을 막기 위해 제외
    ...CATEGORIES.filter((c) => c !== "기타").map((c) => ({
      url: `${base}/category/${encodeURIComponent(c)}`,
      lastModified: today,
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
