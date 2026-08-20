import { NextResponse } from "next/server";
import { clearUserSession } from "@/lib/usersession";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await clearUserSession();
  const siteUrl = process.env.SITE_URL || new URL(req.url).origin;
  return NextResponse.redirect(siteUrl + "/");
}
