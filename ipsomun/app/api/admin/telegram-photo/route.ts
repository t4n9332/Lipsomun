import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { sendTelegramPhoto } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * social-card.mjs가 로컬에서 만든 카드 PNG를 텔레그램 채널에 올리는 중계 엔드포인트.
 * 텔레그램 봇 토큰은 Vercel 환경변수에만 있어 로컬 스크립트가 직접 호출할 수 없다 —
 * 관리자 쿠키로 인증한 뒤 서버가 대신 sendPhoto를 호출한다.
 * body(multipart/form-data): photo(file), caption(string, 선택)
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof Blob)) {
    return NextResponse.json({ error: "photo 파일이 필요합니다" }, { status: 400 });
  }
  const caption = String(form?.get("caption") || "").slice(0, 1024);
  const result = await sendTelegramPhoto(photo, caption);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
