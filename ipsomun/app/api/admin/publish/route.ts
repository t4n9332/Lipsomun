import { NextResponse } from "next/server";
import { getById, setProductPublished } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * 게시 여부만 부분 업데이트 (링크·리뷰 등 다른 필드는 보존).
 * body: { productId, published: boolean }
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const { productId, published } = body || {};
  if (!productId || typeof published !== "boolean") {
    return NextResponse.json(
      { error: "productId와 published(boolean)가 필요합니다" },
      { status: 400 }
    );
  }
  const product = await getById(productId);
  if (!product) {
    return NextResponse.json({ error: "제품을 찾을 수 없습니다" }, { status: 404 });
  }
  await setProductPublished(productId, published);
  revalidatePath(`/p/${product.slug}`);
  revalidatePath("/");
  return NextResponse.json({ ok: true, productId, slug: product.slug, published });
}
