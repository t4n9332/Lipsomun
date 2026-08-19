import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  createLinkpriceLink,
  detectPlatform,
  fetchProductMeta,
} from "@/lib/linkprice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 상품 URL 목록 → 각각에 대해
 *  1) 링크프라이스 딥링크 API로 제휴링크 생성
 *  2) 상품 페이지에서 제목·이미지·가격 자동 추출(OG 메타)
 * 을 수행해 등록 초안(draft)을 돌려준다.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const urls: string[] = Array.isArray(body?.urls)
    ? body.urls
        .filter((u: unknown) => typeof u === "string")
        .map((u: string) => u.trim())
        .filter((u: string) => u.startsWith("http"))
        .slice(0, 15)
    : [];
  if (urls.length === 0) {
    return NextResponse.json(
      { error: "상품 URL을 한 줄에 하나씩 입력하세요." },
      { status: 400 }
    );
  }

  const drafts = await Promise.all(
    urls.map(async (url) => {
      const [link, meta] = await Promise.all([
        createLinkpriceLink(url),
        fetchProductMeta(url),
      ]);
      return {
        originalUrl: url,
        platform: detectPlatform(url),
        affiliateUrl: link.affiliateUrl,
        linkError: link.error ?? null,
        title: meta.title,
        imageUrl: meta.imageUrl,
        price: meta.price,
        description: meta.description,
      };
    })
  );

  return NextResponse.json({ drafts });
}
