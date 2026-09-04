import { NextResponse } from "next/server";
import { getPriceStats } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 상품 하나의 가격 히스토리 통계 (블로그 초안 생성기 등 외부 스크립트용) */
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });
  }
  const stats = await getPriceStats(id);
  return NextResponse.json({ stats });
}
