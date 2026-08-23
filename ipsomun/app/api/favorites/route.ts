import { NextResponse } from "next/server";
import { getFavoriteSlugs, setFavorite, mergeFavorites } from "@/lib/db";
import { getUserId } from "@/lib/usersession";

export const dynamic = "force-dynamic";

/** 로그인한 사용자의 서버 저장 찜 목록 */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ loggedIn: false, slugs: [] });
  const slugs = await getFavoriteSlugs(userId);
  return NextResponse.json({ loggedIn: true, slugs });
}

/** 찜 토글 (비로그인은 무시 — 로컬 저장만 사용) */
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ loggedIn: false });
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!slug) return NextResponse.json({ error: "slug 필요" }, { status: 400 });
  await setFavorite(userId, slug, !!body.on);
  return NextResponse.json({ loggedIn: true, ok: true });
}

/** 로컬(기기) 찜 목록을 계정에 병합 */
export async function PUT(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ loggedIn: false });
  const body = await req.json().catch(() => null);
  const slugs: string[] = Array.isArray(body?.slugs) ? body.slugs : [];
  await mergeFavorites(userId, slugs);
  const merged = await getFavoriteSlugs(userId);
  return NextResponse.json({ loggedIn: true, slugs: merged });
}
