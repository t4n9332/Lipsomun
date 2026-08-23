import { NextResponse } from "next/server";
import { suggestTitles } from "@/lib/db";
import { CATEGORIES } from "@/lib/util";

export const dynamic = "force-dynamic";

/** 검색 자동완성: 제품명 + 카테고리명 제안 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 1) return NextResponse.json({ suggestions: [] });

  try {
    const titles = await suggestTitles(q, 7);
    const cats = CATEGORIES.filter((c) => c.includes(q)).map((c) => ({
      type: "category" as const,
      text: c,
    }));
    const suggestions = [
      ...cats.slice(0, 2),
      ...titles.map((t) => ({ type: "product" as const, text: t })),
    ].slice(0, 8);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
