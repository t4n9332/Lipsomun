import { NextResponse } from "next/server";
import { savePushSubscription } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint || typeof sub.endpoint !== "string") {
    return NextResponse.json({ error: "잘못된 구독 정보" }, { status: 400 });
  }
  await savePushSubscription(sub);
  return NextResponse.json({ ok: true });
}
