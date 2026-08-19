import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { searchProducts } from "@/lib/coupang";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const url = new URL(req.url);
  const keyword = (url.searchParams.get("keyword") || "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") || 10), 20);
  if (!keyword) {
    return NextResponse.json({ error: "keyword가 필요합니다" }, { status: 400 });
  }
  try {
    const products = await searchProducts(keyword, limit);
    return NextResponse.json({ products });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "쿠팡 API 호출 실패" },
      { status: 502 }
    );
  }
}
