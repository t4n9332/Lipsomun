import { q } from "@/lib/db";
import { isFreshPost } from "@/lib/util";
import { monthLabel } from "@/lib/cvs";
import { CUR, CROSS, HAS_DATA, HAS_PREV } from "@/lib/cvsData";

export const revalidate = 1800; // RSS

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * RSS 피드 — 검색엔진(특히 네이버 서치어드바이저) 색인 촉진 + 구독 유입.
 * 직접 만든 콘텐츠(편의점 행사·비교)를 맨 앞에 두고, 상품은 리뷰가 있는(색인 대상) 것만,
 * 자동 리포트는 색인 기간(BLOG_INDEX_DAYS) 안의 것만 싣는다 — 검색 제외 페이지를 피드로 밀지 않게.
 */
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let postRows: any[] = [];
  try {
    [rows, postRows] = await Promise.all([
      q(
        `SELECT title, slug, description, image_url, price, is_deal, updated_at
         FROM products
         WHERE is_published AND (COALESCE(review,'') <> '' OR COALESCE(pros,'') <> '' OR COALESCE(cons,'') <> '')
         ORDER BY updated_at DESC LIMIT 40`
      ),
      q(`SELECT title, slug, created_at FROM posts ORDER BY created_at DESC LIMIT 20`),
    ]);
  } catch {}

  const postItems = postRows
    .filter((r) => !String(r.slug).startsWith("compare-") || isFreshPost(r.created_at))
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
    <title>입소문 — 편의점 행사·가격비교·생활 계산기</title>
    <link>${SITE}</link>
    <description>매월 편의점 1+1·2+1 비교, 매일 쿠팡·토스쇼핑 가격비교, 2026 생활 계산기</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${cvsItems()}
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

/** 편의점 행사 — 달마다 새 guid 라 매월 새 글로 수집된다 */
function cvsItems(): string {
  if (!HAS_DATA) return "";
  const M = monthLabel(CUR.month);
  const date = new Date(CUR.generated_at || Date.now()).toUTCString();
  const item = (path: string, title: string, desc: string) => {
    const link = `${SITE}${path}`;
    return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${esc(`${link}#${CUR.month}`)}</guid>
      <description>${esc(desc)}</description>
      <pubDate>${date}</pubDate>
    </item>`;
  };
  return [
    item("/cvs", `${M} 편의점 행사 총정리 — CU·세븐일레븐·이마트24 1+1·2+1`, `${M} 편의점 행사상품 ${CUR.items.length.toLocaleString("ko-KR")}개를 1개당 가격으로 정리했습니다.`),
    item("/cvs/compare", `${M} 같은 상품, 어느 편의점이 1개당 가장 쌀까`, `두 곳 이상에서 행사하는 같은 상품 ${CROSS.length}개를 1개당 가격으로 비교했습니다.`),
    ...(HAS_PREV ? [item("/cvs/patch", `${M} 편의점 행사 패치노트 — 버프·너프 총정리`, "지난달보다 좋아진·나빠진 편의점 행사를 정리했습니다.")] : []),
  ].join("\n");
}
