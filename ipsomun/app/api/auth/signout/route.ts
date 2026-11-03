import { NextResponse } from "next/server";
import { clearUserSession } from "@/lib/usersession";
import { notCrossSite } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const siteUrl = process.env.SITE_URL || new URL(req.url).origin;
  // 다른 사이트의 링크·이미지로 강제 로그아웃시키는 CSRF 차단
  if (!notCrossSite(req)) return NextResponse.redirect(siteUrl + "/");
  await clearUserSession();
  return NextResponse.redirect(siteUrl + "/");
}
