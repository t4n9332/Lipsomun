import { NextResponse } from "next/server";
import {
  getPriceCompareProducts,
  createPost,
  kstToday,
  type ProductWithLinks,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

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
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const cronOk =
    !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk && !(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  try {
    const all = await getPriceCompareProducts(100);
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
      totalCompare: all.length,
      totalSavings,
    });

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
