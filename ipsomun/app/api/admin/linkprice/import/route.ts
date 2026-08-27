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
 *
 * mode="asis"이면 1)을 건너뛰고 붙여넣은 URL을 그대로 제휴링크로 쓴다.
 * 네이버 브랜드커넥트처럼 **이미 발급받은 제휴링크**를 넣는 경우로,
 * 이걸 다시 링크프라이스에 넣으면 변환이 실패하거나 엉뚱한 링크가 된다.
 * platform을 함께 주면 도메인 추측 대신 그 값을 쓴다(브랜드커넥트 링크는
 * 도메인만으로 네이버인지 판별되지 않는다).
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

  const asIs = body?.mode === "asis";
  const forcedPlatform =
    typeof body?.platform === "string" && body.platform.trim() ? body.platform.trim() : null;

  const drafts = await Promise.all(
    urls.map(async (url) => {
      // asis 모드는 붙여넣은 링크가 이미 제휴링크이므로 변환하지 않는다.
      const [link, meta] = await Promise.all([
        asIs
          ? Promise.resolve({ affiliateUrl: url, error: null as string | null })
          : createLinkpriceLink(url),
        fetchProductMeta(url),
      ]);
      return {
        originalUrl: url,
        platform: forcedPlatform ?? detectPlatform(url),
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
