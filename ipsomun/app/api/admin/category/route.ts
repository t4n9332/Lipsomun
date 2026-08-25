import { NextResponse } from "next/server";
import { getById, setProductCategory } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { CATEGORIES } from "@/lib/util";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * 카테고리만 부분 업데이트 (링크·리뷰 등 다른 필드는 보존).
 * body: { productId, category }
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const { productId, category } = body || {};
  if (!productId || typeof category !== "string" || !CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `productId와 유효한 category가 필요합니다 (${CATEGORIES.join(", ")})` },
      { status: 400 }
    );
  }
  const product = await getById(productId);
  if (!product) {
    return NextResponse.json({ error: "제품을 찾을 수 없습니다" }, { status: 404 });
  }
  const before = product.category;
  await setProductCategory(productId, category);
  revalidatePath(`/p/${product.slug}`);
  revalidatePath(`/category/${encodeURIComponent(before)}`);
  revalidatePath(`/category/${encodeURIComponent(category)}`);
  revalidatePath("/");
  return NextResponse.json({ ok: true, productId, slug: product.slug, before, after: category });
}
