import { NextResponse } from "next/server";
import { goldboxProducts } from "@/lib/coupang";
import {
  createProduct,
  findBySourceTitle,
  reviveDeal,
  unsetDealsBySource,
  snapshotPrices,
} from "@/lib/db";
import { cronOrAdmin } from "@/lib/auth";
import { sendPushToAll, sendFavoritePriceDropPush } from "@/lib/push";
import { sendTelegram, escHtml } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE = "goldbox";

/**
 * 쿠팡 골드박스(오늘의 특가)를 '오늘의 딜'로 자동 등록.
 * - vercel.json의 crons 설정으로 매일 아침 자동 실행
 * - 관리자 로그인 상태에서 브라우저로 직접 열어 수동 실행도 가능
 *
 * 가격 스냅샷·찜 가격인하 푸시는 골드박스 API 성공 여부와 무관하게 먼저 돈다.
 * (전에는 골드박스 뒤에 있어서 쿠팡 API가 한 번만 죽어도 그날 price_history가
 * 결번되고 역대최저가·가격 그래프에 구멍이 났다.)
 */
export async function GET(req: Request) {
  // 인증: Vercel Cron(Bearer CRON_SECRET) 또는 관리자 쿠키(교차 출처 링크 클릭은 거절)
  if (!(await cronOrAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  // 찜 상품 가격 인하 알림 (어제 스냅샷과 비교 — 오늘 스냅샷 저장 전에 계산)
  let dropPush = { users: 0, sent: 0 };
  try {
    dropPush = await sendFavoritePriceDropPush();
  } catch {}

  // 전 상품 가격 스냅샷 저장 (역대 최저가 뱃지/그래프용) — 유일한 호출처이므로 반드시 먼저
  let snapshots = 0;
  let snapshotError = "";
  try {
    snapshots = await snapshotPrices();
  } catch (e) {
    snapshotError = e instanceof Error ? e.message : String(e);
  }

  try {
    const items = await withRetry(() => goldboxProducts(20));
    if (items.length === 0) {
      return NextResponse.json({
        ok: true,
        message: `골드박스 상품이 비어있습니다 (API 응답 0개). 가격 스냅샷 ${snapshots}개`,
        snapshots,
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
        url: "/deals?utm_source=push&utm_medium=push",
      });
    } catch {}

    if (snapshotError) {
      await sendTelegram(
        `⚠️ <b>입소문 알림</b>\n가격 스냅샷 저장 실패: ${escHtml(snapshotError.slice(0, 200))}`
      ).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      message: `골드박스 갱신 완료 — 신규 ${created}개, 재등록 ${revived}개, 딜 해제 ${cleared}개, 가격 스냅샷 ${snapshots}개, 가격인하 푸시 ${dropPush.sent}건, 전체 푸시 ${push.sent}명 발송`,
      created,
      revived,
      cleared,
      snapshots,
      dropPush,
      push,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "골드박스 갱신 실패";
    // 로컬 로그에는 아예 흔적이 남지 않는 크론이라 텔레그램으로 알린다 (실패를 삼키므로 안전)
    await sendTelegram(
      `⚠️ <b>입소문 알림</b>\n골드박스 크론 실패: ${escHtml(message.slice(0, 300))}\n(가격 스냅샷 ${snapshots}개는 저장됨)`
    ).catch(() => {});
    return NextResponse.json(
      { ok: false, error: message, snapshots },
      { status: 502 }
    );
  }
}

/** 쿠팡 API가 아침에 한 번 5xx/타임아웃을 내는 경우를 위한 1회 재시도 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      return await fn();
    } catch {
      throw e;
    }
  }
}
