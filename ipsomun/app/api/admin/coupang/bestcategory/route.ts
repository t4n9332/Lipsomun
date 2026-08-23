import { NextResponse } from "next/server";
import { bestCategoryProducts } from "@/lib/coupang";
import { createProduct, findBySourceTitle } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 쿠팡 카테고리별 베스트 상품을 사이트 카테고리로 일괄 등록.
 * 사용: /api/admin/coupang/bestcategory?categoryId=1016&category=가전/디지털&limit=10
 * (관리자 로그인 필요. 이미 등록된 상품(같은 제목)은 건너뜀)
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const url = new URL(req.url);
  const categoryId = Number(url.searchParams.get("categoryId"));
  const category = (url.searchParams.get("category") || "기타").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") || 10), 20);
  if (!categoryId) {
    return NextResponse.json(
      { error: "categoryId가 필요합니다 (예: 1016)" },
      { status: 400 }
    );
  }

  try {
    const items = await bestCategoryProducts(categoryId, limit);
    let created = 0;
    let skipped = 0;
    for (const it of items) {
      if (!it.productName || !it.productUrl) continue;
      const existing = await findBySourceTitle("bestcategory", it.productName);
      if (existing) {
        skipped++;
        continue;
      }
      await createProduct({
        title: it.productName,
        imageUrl: it.productImage || "",
        price: it.productPrice ?? null,
        category,
        isDeal: false,
        isPublished: true,
        source: "bestcategory",
        description: "쿠팡 카테고리 베스트 상품",
        links: [{ platform: "coupang", url: it.productUrl }],
      });
      created++;
    }
    return NextResponse.json({
      ok: true,
      message: `[${category}] 베스트 상품 등록 완료 — 신규 ${created}개, 중복 건너뜀 ${skipped}개`,
      created,
      skipped,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "베스트 상품 등록 실패" },
      { status: 502 }
    );
  }
}
