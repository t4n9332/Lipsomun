import { NextResponse } from "next/server";
import { CATEGORIES, categoryFromSlug, categorySlug } from "@/lib/cvs";
import { itemsInCategory } from "@/lib/cvsData";

/** 분류별 4사 통합 행사 목록 JSON (1개당 가격 싼 순) — 빌드 때 정적 생성 */
export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ cat: categorySlug(c) }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ cat: string }> }) {
  const c = categoryFromSlug((await params).cat);
  if (!c) return NextResponse.json([], { status: 404 });
  return NextResponse.json(itemsInCategory(c));
}
