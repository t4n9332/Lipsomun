import { NextResponse } from "next/server";
import {
  getPriceCompareProducts,
  getAllTimeLows,
  createPost,
  updatePost,
  getPosts,
  kstToday,
  type ProductWithLinks,
} from "@/lib/db";
import { cronOrAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/** 직전 글과 겹치지 않는 새 상품이 이만큼은 있어야 새 URL로 발행한다 */
const MIN_NEW_ITEMS = 3;

function effPrices(p: ProductWithLinks): { coupang: number | null; toss: number | null } {
  const c = p.links.find((l) => l.platform === "coupang");
  const t = p.links.find((l) => l.platform === "toss");
  return {
    coupang: c ? (c.price ?? p.price) : null,
    toss: t ? t.price : null,
  };
}

/**
 * 그날의 가격비교 데이터로 블로그 글을 자동 발행.
 * - 매일 자동 매칭(toss-playwright --auto) 직후 호출되어 데이터가 가장 신선한 시점에 생성
 * - 같은 날짜 글이 이미 있으면 건너뜀 (하루 1개)
 * - 직전 글과 상품 세트가 거의 같으면(새 상품 3개 미만) 새 URL을 만들지 않고
 *   직전 글의 본문만 갱신한다. 전에는 사흘 연속 같은 8개(총 절약액 327,390원)가
 *   날짜만 다른 새 URL로 나가 근중복 페이지가 매일 IndexNow로 제출됐다.
 */
export async function GET(req: Request) {
  if (!(await cronOrAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  try {
    const [all, lowsRaw, recentPosts] = await Promise.all([
      getPriceCompareProducts(100),
      getAllTimeLows(5).catch(() => []),
      getPosts(1).catch(() => []),
    ]);
    const lows = lowsRaw.map((p) => ({
      slug: p.slug,
      title: p.title,
      price: p.price,
    }));
    const items = all
      .map((p) => {
        const { coupang, toss } = effPrices(p);
        return {
          slug: p.slug,
          title: p.title,
          imageUrl: p.imageUrl,
          coupang,
          toss,
          rating: p.rating,
          ratingCount: p.ratingCount,
          savings: coupang != null && toss != null ? Math.abs(coupang - toss) : 0,
        };
      })
      .filter((i) => i.coupang != null && i.toss != null && i.savings > 0)
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 8);

    if (items.length < 3) {
      return NextResponse.json({
        ok: true,
        message: `가격차가 있는 비교 상품이 ${items.length}개뿐이라 오늘은 글을 만들지 않았습니다 (최소 3개).`,
      });
    }

    const date = kstToday(); // YYYY-MM-DD
    const [y, m, d] = date.split("-").map(Number);
    const slug = `compare-${date}`;
    const title = `쿠팡 vs 토스 가격비교 TOP${items.length} — ${m}월 ${d}일 최저가 리포트`;
    const totalSavings = items.reduce((s, i) => s + i.savings, 0);

    const content = JSON.stringify({
      type: "daily-compare",
      date,
      items,
      lows,
      totalCompare: all.length,
      totalSavings,
    });

    // 직전 글과 비교 — 새 상품이 적으면 그 글을 갱신(같은 URL, lastmod만 바뀜)
    const prev = recentPosts[0];
    if (prev && prev.slug !== slug && prev.slug.startsWith("compare-")) {
      let prevSlugs = new Set<string>();
      try {
        const parsed = JSON.parse(prev.content) as { items?: { slug: string }[] };
        prevSlugs = new Set((parsed.items || []).map((i) => i.slug));
      } catch {}
      const fresh = items.filter((i) => !prevSlugs.has(i.slug)).length;
      if (prevSlugs.size > 0 && fresh < MIN_NEW_ITEMS) {
        const updated = await updatePost(prev.slug, prev.title, content);
        if (updated) {
          revalidatePath("/blog");
          revalidatePath(`/blog/${prev.slug}`);
        }
        return NextResponse.json({
          ok: true,
          created: false,
          updated,
          slug: prev.slug,
          message: `직전 글과 새 상품이 ${fresh}개뿐(최소 ${MIN_NEW_ITEMS})이라 새 글 대신 ${prev.slug} 본문을 갱신했습니다 (상품 ${items.length}개, 총 절약액 ${totalSavings.toLocaleString("ko-KR")}원)`,
        });
      }
    }

    const created = await createPost(slug, title, content);
    if (created) {
      revalidatePath("/blog");
      revalidatePath(`/blog/${slug}`);
    }
    return NextResponse.json({
      ok: true,
      message: created
        ? `블로그 글 발행: ${title} (상품 ${items.length}개, 총 절약액 ${totalSavings.toLocaleString("ko-KR")}원)`
        : `오늘(${date}) 글이 이미 있습니다 — 건너뜀`,
      created,
      slug,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "블로그 발행 실패" },
      { status: 502 }
    );
  }
}
