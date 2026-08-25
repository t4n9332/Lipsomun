import { NextResponse } from "next/server";
import { incrementViews } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 조회수 집계.
 * 상품 페이지를 ISR로 캐싱하면 서버 렌더가 매 방문마다 실행되지 않으므로,
 * 조회수는 클라이언트(ViewTracker)에서 이 엔드포인트로 따로 보고한다.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });

  await incrementViews(id).catch(() => {});
  return NextResponse.json({ ok: true });
}
