import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createLinkpriceLink } from "@/lib/linkprice";

export const dynamic = "force-dynamic";

/** 단일 URL → 링크프라이스 제휴링크 변환 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url.startsWith("http")) {
    return NextResponse.json({ error: "url이 필요합니다" }, { status: 400 });
  }
  const result = await createLinkpriceLink(url);
  if (!result.affiliateUrl) {
    return NextResponse.json({ error: result.error || "변환 실패" }, { status: 502 });
  }
  return NextResponse.json({ affiliateUrl: result.affiliateUrl });
}
