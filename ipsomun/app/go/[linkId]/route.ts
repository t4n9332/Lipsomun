import { NextResponse } from "next/server";
import { getLink, trackClick } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params;
  const link = await getLink(linkId).catch(() => null);
  if (!link) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // 클릭 수 집계 (실패해도 리다이렉트는 진행)
  await trackClick(link.id, link.productId).catch(() => {});

  return NextResponse.redirect(link.url, 302);
}
