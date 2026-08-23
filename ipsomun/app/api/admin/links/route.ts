import { NextResponse } from "next/server";
import { getById, upsertLink } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * 상품에 플랫폼 링크 추가/교체 (같은 플랫폼 링크가 있으면 교체).
 * 토스쇼핑 가격비교 매칭 도구에서 사용.
 * body: { productId, platform, url, price? }
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const { productId, platform, url, price } = body || {};
  if (!productId || !platform || typeof url !== "string" || !url.startsWith("http")) {
    return NextResponse.json(
      { error: "productId, platform, url(http로 시작)이 필요합니다" },
      { status: 400 }
    );
  }
  const product = await getById(productId);
  if (!product) {
    return NextResponse.json({ error: "제품을 찾을 수 없습니다" }, { status: 404 });
  }
  await upsertLink(
    productId,
    String(platform),
    url,
    typeof price === "number" && price > 0 ? Math.round(price) : null
  );
  revalidatePath(`/p/${product.slug}`);
  return NextResponse.json({ ok: true, productId, platform });
}
