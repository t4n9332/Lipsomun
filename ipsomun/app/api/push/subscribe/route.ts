import { NextResponse } from "next/server";
import { savePushSubscription } from "@/lib/db";
import { getUserId } from "@/lib/usersession";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint || typeof sub.endpoint !== "string") {
    return NextResponse.json({ error: "잘못된 구독 정보" }, { status: 400 });
  }
  // 로그인 상태면 구독을 계정과 연결 (찜 가격인하 알림용)
  const userId = await getUserId();
  await savePushSubscription(sub, userId);
  return NextResponse.json({ ok: true });
}
