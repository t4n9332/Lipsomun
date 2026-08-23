import { NextResponse } from "next/server";
import { goldboxProducts } from "@/lib/coupang";
import {
  createProduct,
  findBySourceTitle,
  reviveDeal,
  unsetDealsBySource,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { sendPushToAll } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE = "goldbox";

/**
 * 쿠팡 골드박스(오늘의 특가)를 '오늘의 딜'로 자동 등록.
 * - vercel.json의 crons 설정으로 매일 아침 자동 실행
 * - 관리자 로그인 상태에서 브라우저로 직접 열어 수동 실행도 가능
 */
export async function GET(req: Request) {
  // 인증: Vercel Cron(Bearer CRON_SECRET) 또는 관리자 쿠키
  const auth = req.headers.get("authorization") || "";
  const cronOk =
    !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk && !(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  try {
    const items = await goldboxProducts(20);
    if (items.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "골드박스 상품이 비어있습니다 (API 응답 0개).",
      });
    }

    // 어제 골드박스로 올라간 딜 표시 해제 (제품 자체는 카탈로그에 유지)
    const cleared = await unsetDealsBySource(SOURCE);

    let created = 0;
    let revived = 0;
    for (const it of items) {
      if (!it.productName || !it.productUrl) continue;
      const existing = await findBySourceTitle(SOURCE, it.productName);
      if (existing) {
        await reviveDeal(existing.id, it.productPrice ?? null);
        revived++;
      } else {
        await createProduct({
          title: it.productName,
          imageUrl: it.productImage || "",
          price: it.productPrice ?? null,
          category: "기타",
          isDeal: true,
          isPublished: true,
          source: SOURCE,
          description: "쿠팡 골드박스 오늘의 특가",
          links: [{ platform: "coupang", url: it.productUrl }],
        });
        created++;
      }
    }

    // 구독자에게 웹푸시 발송 (실패해도 갱신 결과에는 영향 없음)
    let push = { sent: 0, removed: 0 };
    try {
      push = await sendPushToAll({
        title: "🔥 오늘의 특가 도착!",
        body: `쿠팡 골드박스 새 딜 ${created + revived}개가 올라왔어요. 놓치기 전에 확인하세요!`,
        url: "/deals",
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      message: `골드박스 갱신 완료 — 신규 ${created}개, 재등록 ${revived}개, 딜 해제 ${cleared}개, 푸시 ${push.sent}명 발송`,
      created,
      revived,
      cleared,
      push,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "골드박스 갱신 실패" },
      { status: 502 }
    );
  }
}
