import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY || "";
  if (!key) {
    return NextResponse.json({ error: "푸시 미설정" }, { status: 500 });
  }
  return NextResponse.json({ key });
}
