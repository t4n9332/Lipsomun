import { NextResponse } from "next/server";
import { tossTodayDeals, tossBestSelling, createSharelink, tossConfigured } from "@/lib/toss";
import {
  createProduct,
  findBySourceTitle,
  reviveDeal,
  unsetDealsBySource,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE = "toss-todaydeal";

/**
 * 토스쇼핑 하루특가를 '오늘의 딜'로 자동 등록.
 * - 각 상품마다 쉐어링크(수익 추적 링크)를 발급해 함께 저장
 * - 하루특가 편성이 없는 날은 베스트셀러 상위 상품으로 대체
 * - vercel.json의 crons 설정으로 매일 아침 자동 실행, 관리자 수동 실행도 가능
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const cronOk =
    !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk && !(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  if (!tossConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "토스 쉐어링크 API 키가 설정되지 않았습니다. TOSS_SHARELINK_ACCESS_KEY / TOSS_SHARELINK_SECRET_KEY / TOSS_SHARELINK_PUBLISHER_ID 환경변수를 등록하세요. (발급: sharelink.toss.im > API 연동)",
      },
      { status: 400 }
    );
  }

  try {
    let items = await tossTodayDeals(30);
    let usedFallback = false;
    if (items.length === 0) {
      // 하루특가 편성이 없는 날 — 베스트셀러로 대체
      items = await tossBestSelling(20);
      usedFallback = true;
    }
    items = items.filter((it) => !it.isSoldOut && it.displayName);

    if (items.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "토스쇼핑 하루특가/베스트 상품이 비어있습니다.",
      });
    }

    const cleared = await unsetDealsBySource(SOURCE);

    let created = 0;
    let revived = 0;
    let linkFail = 0;
    for (const it of items) {
      const existing = await findBySourceTitle(SOURCE, it.displayName);
      if (existing) {
        await reviveDeal(existing.id, it.displayPrice ?? null, {
          originalPrice: it.originalPrice ?? null,
          rating: it.reviewScore ?? null,
          ratingCount: it.reviewCount ?? null,
        });
        revived++;
        continue;
      }
      // 수익 추적용 쉐어링크 발급 (실패 시 해당 상품은 건너뜀 — 일반 링크는 수익 집계 안 됨)
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
        category: "기타",
        isDeal: true,
        isPublished: true,
        source: SOURCE,
        description: usedFallback
          ? "토스쇼핑 인기 상품"
          : "토스쇼핑 하루특가 — 오늘 하루만 이 가격!",
        rating: it.reviewScore ?? null,
        ratingCount: it.reviewCount ?? null,
        links: [{ platform: "toss", url: shortUrl }],
      });
      created++;
    }

    return NextResponse.json({
      ok: true,
      message: `토스쇼핑 ${usedFallback ? "베스트" : "하루특가"} 갱신 완료 — 신규 ${created}개, 재등록 ${revived}개, 딜 해제 ${cleared}개${linkFail ? `, 링크 발급 실패 ${linkFail}개` : ""}`,
      created,
      revived,
      cleared,
      linkFail,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "토스쇼핑 딜 갱신 실패",
      },
      { status: 502 }
    );
  }
}
