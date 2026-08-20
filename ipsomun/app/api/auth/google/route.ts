import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/** 구글 로그인 시작: 구글 동의 화면으로 리다이렉트 */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const siteUrl = process.env.SITE_URL || new URL(req.url).origin;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${siteUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  const res = NextResponse.redirect(
    "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString()
  );
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
