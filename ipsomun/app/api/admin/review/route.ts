import { NextResponse } from "next/server";
import { getById, updateReviewContent } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * 리뷰 콘텐츠만 부분 업데이트 (리뷰 보강 도구용 — 링크·가격 등 다른 필드는 보존).
 * body: { productId, review, pros, cons, description? }
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const { productId, review, pros, cons, description } = body || {};
  if (!productId || typeof review !== "string" || !review.trim()) {
    return NextResponse.json(
      { error: "productId와 review가 필요합니다" },
      { status: 400 }
    );
  }
  const product = await getById(productId);
  if (!product) {
    return NextResponse.json({ error: "제품을 찾을 수 없습니다" }, { status: 404 });
  }
  await updateReviewContent(
    productId,
    review.trim(),
    typeof pros === "string" ? pros.trim() : "",
    typeof cons === "string" ? cons.trim() : "",
    typeof description === "string" ? description.trim() : undefined
  );
  revalidatePath(`/p/${product.slug}`);
  revalidatePath("/");
  return NextResponse.json({ ok: true, productId, slug: product.slug });
}
