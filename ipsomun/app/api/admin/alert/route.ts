import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { sendTelegram, escHtml } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * 로컬 자동화 스크립트(toss-playwright.mjs 등)가 운영자 개입이 필요한
 * 상황(세션 만료 등)을 텔레그램으로 즉시 알릴 때 쓰는 범용 알림 엔드포인트.
 * body: { text }
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const text = (body?.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "text가 필요합니다" }, { status: 400 });
  }
  const result = await sendTelegram(`⚠️ <b>입소문 알림</b>\n${escHtml(text)}`);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "발송 실패" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
