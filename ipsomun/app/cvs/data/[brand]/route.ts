import { NextResponse } from "next/server";
import { BRANDS, isBrand } from "@/lib/cvs";
import { CUR } from "@/lib/cvsData";

/**
 * 편의점별 행사 전체 목록 JSON — 빌드 때 정적 파일로 만들어진다.
 * 행사 페이지는 처음에 일부만 그리고(가볍게), '더 보기'·검색 때 이 파일을 받아 나머지를 그린다.
 * 1,700개를 HTML 로 다 그리면 페이지가 5MB 가 넘었다(2026-11 실측).
 */
export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return BRANDS.map((b) => ({ brand: b.id }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  if (!isBrand(brand)) return NextResponse.json([], { status: 404 });
  return NextResponse.json(CUR.items.filter((x) => x.b === brand));
}
