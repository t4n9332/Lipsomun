import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createDeeplinks } from "@/lib/coupang";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const urls: string[] = Array.isArray(body?.urls)
    ? body.urls.filter((u: unknown) => typeof u === "string" && u.trim())
    : [];
  if (urls.length === 0) {
    return NextResponse.json(
      { error: "urls 배열이 필요합니다" },
      { status: 400 }
    );
  }
  try {
    const links = await createDeeplinks(urls.slice(0, 20));
    return NextResponse.json({ links });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "쿠팡 API 호출 실패" },
      { status: 502 }
    );
  }
}
