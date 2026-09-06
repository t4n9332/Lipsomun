import { NextResponse } from "next/server";
import { getById } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 짧은 ASCII 주소 → 상품 페이지.
 * 슬러그가 한글이라 스레드·네이버 블로그·캡션에 붙이면 190자짜리 퍼센트 인코딩
 * 링크가 되고, 스레드 앱에서는 링크 인식도 불안정하다. /r/<uuid>는 60자 안팎이고
 * 쿼리(utm_*)를 그대로 넘겨 채널 측정도 유지한다. canonical은 /p/ 그대로.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = /^[A-Za-z0-9-]{8,64}$/.test(id) ? await getById(id).catch(() => null) : null;
  const url = new URL(req.url);
  if (!product || !product.isPublished) {
    return NextResponse.redirect(new URL("/", url), 302);
  }
  const target = new URL(`/p/${encodeURIComponent(product.slug)}`, url);
  target.search = url.search;
  return NextResponse.redirect(target, 308);
}
