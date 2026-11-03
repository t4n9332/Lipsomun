import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/db";
import { setUserSession } from "@/lib/usersession";

export const dynamic = "force-dynamic";

/** 구글 로그인 콜백: 코드 교환 → 사용자 정보 → 세션 쿠키 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const siteUrl = process.env.SITE_URL || url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = req.headers.get("cookie") || "";
  const savedState = /(?:^|;\s*)oauth_state=([^;]+)/.exec(cookieHeader)?.[1];

  // 한 번 쓴 state 쿠키는 성공·실패와 무관하게 지운다 (재사용 방지)
  const done = (path: string) => {
    const res = NextResponse.redirect(`${siteUrl}${path}`);
    res.cookies.delete("oauth_state");
    return res;
  };

  if (!code || !state || state !== savedState) {
    return done("/my?error=login");
  }

  try {
    // 1) 코드 → 토큰 교환
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${siteUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const token = await tokenRes.json();
    if (!token.access_token) throw new Error("token exchange failed");

    // 2) 사용자 정보
    const infoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    );
    const info = await infoRes.json();
    // 인증 안 된 이메일로 기존 계정에 병합되는 것을 막는다
    if (!info.email || info.email_verified !== true) throw new Error("no verified email");

    // 3) 회원 저장 + 세션
    const user = await upsertUser(
      info.email,
      info.name || info.email.split("@")[0],
      info.picture || ""
    );
    await setUserSession(user.id);

    return done("/my?welcome=1");
  } catch {
    return done("/my?error=login");
  }
}
