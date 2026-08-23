import { NextResponse } from "next/server";
import {
  tossBestSelling,
  tossBestCategory,
  tossCategories,
  createSharelink,
  tossConfigured,
} from "@/lib/toss";
import { createProduct, findBySourceTitle } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE = "toss-best";

/**
 * 토스쇼핑 베스트 상품을 쉐어링크(수익 링크) 포함으로 일괄 등록.
 * 사용:
 *   /api/admin/toss/best?limit=20                          — 전체 베스트셀러
 *   /api/admin/toss/best?categoryId=101&category=패션&limit=20 — 토스 카테고리 베스트
 *   /api/admin/toss/best?list=categories                   — 토스 카테고리 트리 확인
 * (관리자 로그인 필요. 같은 제목의 기존 상품은 건너뜀)
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  if (!tossConfigured()) {
    return NextResponse.json(
      {
        error:
          "토스 쉐어링크 API 키가 설정되지 않았습니다. TOSS_SHARELINK_ACCESS_KEY / TOSS_SHARELINK_SECRET_KEY / TOSS_SHARELINK_PUBLISHER_ID 환경변수를 등록하세요.",
      },
      { status: 400 }
    );
  }

  const url = new URL(req.url);

  try {
    // 카테고리 트리 조회 모드
    if (url.searchParams.get("list") === "categories") {
      return NextResponse.json({ ok: true, categories: await tossCategories() });
    }

    const categoryId = Number(url.searchParams.get("categoryId")) || 0;
    const category = (url.searchParams.get("category") || "기타").trim();
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 50);

    const items = categoryId
      ? await tossBestCategory(categoryId, limit)
      : await tossBestSelling(limit);

    let created = 0;
    let skipped = 0;
    let linkFail = 0;
    for (const it of items) {
      if (!it.displayName || it.isSoldOut) continue;
      const existing = await findBySourceTitle(SOURCE, it.displayName);
      if (existing) {
        skipped++;
        continue;
      }
      let shortUrl: string;
      try {
        shortUrl = (await createSharelink(it.tacaItemId)).shortUrl;
      } catch {
        linkFail++;
        continue;
      }
      await createProduct({
        title: it.displayName,
        imageUrl: it.thumbnailUrl || "",
        price: it.displayPrice ?? null,
        originalPrice: it.originalPrice ?? null,
        category,
        isDeal: false,
        isPublished: true,
        source: SOURCE,
        description: "토스쇼핑 베스트 상품",
        rating: it.reviewScore ?? null,
        ratingCount: it.reviewCount ?? null,
        links: [{ platform: "toss", url: shortUrl }],
      });
      created++;
    }

    return NextResponse.json({
      ok: true,
      message: `토스쇼핑 베스트 [${categoryId ? category : "전체"}] 등록 완료 — 신규 ${created}개, 중복 건너뜀 ${skipped}개${linkFail ? `, 링크 발급 실패 ${linkFail}개` : ""}`,
      created,
      skipped,
      linkFail,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "토스 베스트 등록 실패" },
      { status: 502 }
    );
  }
}
