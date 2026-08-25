import { q } from "@/lib/db";

export const revalidate = 1800; // RSS

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 최신 상품 RSS 피드 — 검색엔진 색인 촉진 + RSS 구독 유입 */
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let postRows: any[] = [];
  try {
    [rows, postRows] = await Promise.all([
      q(
        `SELECT title, slug, description, image_url, price, is_deal, updated_at
         FROM products WHERE is_published
         ORDER BY updated_at DESC LIMIT 50`
      ),
      q(`SELECT title, slug, created_at FROM posts ORDER BY created_at DESC LIMIT 20`),
    ]);
  } catch {}

  const postItems = postRows
    .map((r) => {
      const link = `${SITE}/blog/${encodeURIComponent(r.slug)}`;
      return `    <item>
      <title>${esc(r.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <description>${esc("매일 자동 발행되는 쿠팡·토스쇼핑 최저가 비교 리포트")}</description>
      <pubDate>${new Date(r.created_at).toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");

  const items = rows
    .map((r) => {
      const link = `${SITE}/p/${encodeURIComponent(r.slug)}`;
      const priceTxt =
        r.price != null ? ` — ${Number(r.price).toLocaleString("ko-KR")}원` : "";
      const title = `${r.is_deal ? "[오늘의 딜] " : ""}${r.title}${priceTxt}`;
      const desc = r.description || `${r.title} 최저가 비교는 입소문에서 확인하세요.`;
      return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <description>${esc(desc)}</description>
      <pubDate>${new Date(r.updated_at).toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>입소문 — 오늘의 특가와 쿠팡 vs 토스 가격비교</title>
    <link>${SITE}</link>
    <description>매일 갱신되는 특가와 쿠팡·토스쇼핑 가격비교 정보</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${postItems}
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
