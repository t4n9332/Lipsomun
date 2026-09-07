import { NextResponse } from "next/server";
import {
  getDeals,
  getPriceCompareProducts,
  getAllTimeLows,
  type ProductWithLinks,
} from "@/lib/db";
import { cronOrAdmin } from "@/lib/auth";
import { sendTelegram, escHtml, escAttr, telegramConfigured } from "@/lib/telegram";
import { sendPushToAll } from "@/lib/push";
import { won, withUtm, pickPrimary } from "@/lib/util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

function effPrices(p: ProductWithLinks): { coupang: number | null; toss: number | null } {
  const c = p.links.find((l) => l.platform === "coupang");
  const t = p.links.find((l) => l.platform === "toss");
  return { coupang: c ? (c.price ?? p.price) : null, toss: t ? t.price : null };
}

/** 한국시간 기준 오늘 날짜(YYYY-MM-DD) — utm_campaign용 */
function kstDate(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 일일 특가 다이제스트 — 텔레그램 채널 발송 + 역대최저가 웹푸시.
 * 매일 자동 매칭(toss-playwright --auto) 직후 호출됨.
 *
 * ?slot=evening 이면 '저녁 업데이트' 모드: 아침 이후 12시간 안에 가격이 갱신되거나
 * 새로 등록된 가격비교 상품만 보내고, 그런 게 없으면 발송하지 않는다.
 * (전에는 09:30·21:30 두 번 같은 내용이 나가 구독자 이탈 요인이었다.)
 * 웹푸시는 아침 회차에만 — 하루 두 번 같은 상품으로 재발송되던 것을 막는다.
 */
export async function GET(req: Request) {
  if (!(await cronOrAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const url = new URL(req.url);
  const evening = url.searchParams.get("slot") === "evening";
  const campaign = kstDate();
  const link = (slug: string) =>
    withUtm(`${SITE}/p/${encodeURIComponent(slug)}`, "telegram", "social", campaign);

  try {
    const [deals, compareAll, lows] = await Promise.all([
      getDeals(5),
      getPriceCompareProducts(80),
      getAllTimeLows(5).catch(() => []),
    ]);

    const since = Date.now() - 12 * 3600 * 1000;
    const compares = compareAll
      .map((p) => {
        const { coupang, toss } = effPrices(p);
        const savings =
          coupang != null && toss != null ? Math.abs(coupang - toss) : 0;
        const fresh = new Date(p.updatedAt).getTime() >= since;
        return { p, coupang, toss, savings, fresh };
      })
      .filter((x) => x.savings > 0)
      // 저녁 회차는 최근 12시간 안에 바뀐 상품만
      .filter((x) => !evening || x.fresh)
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 5);

    // 저녁 회차는 '바뀐 가격비교'만 싣는다. 역대최저가·오늘의 딜은 아침에 이미 나갔으므로
    // 실을 게 없으면 헤더만 있는 빈 메시지가 되어 발송하지 않는다.
    if (evening && compares.length === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: "저녁 회차 — 아침 이후 바뀐 가격비교가 없어 발송하지 않았습니다",
      });
    }

    // ---------- 텔레그램 다이제스트 ----------
    let telegram: { ok: boolean; error?: string } = {
      ok: false,
      error: "텔레그램 미설정",
    };
    if (telegramConfigured()) {
      const lines: string[] = [];
      const topSave = compares[0]?.savings ?? 0;
      lines.push(
        evening
          ? `<b>🌙 입소문 저녁 업데이트</b>`
          : `<b>🛒 입소문 오늘의 특가 브리핑</b>`
      );
      if (topSave > 0) {
        lines.push(`오늘 최대 <b>${won(topSave)}</b> 차이 — 어디서 사느냐가 가격을 가릅니다`);
      }
      if (lows.length > 0 && !evening) {
        lines.push("");
        lines.push(`<b>🔥 역대 최저가 진입!</b>`);
        for (const p of lows) {
          lines.push(
            `· <a href="${escAttr(link(p.slug))}">${escHtml(p.title.slice(0, 45))}</a> — <b>${won(p.price)}</b>`
          );
        }
      }
      if (compares.length > 0) {
        lines.push("");
        lines.push(evening ? `<b>🆚 오늘 바뀐 가격비교</b>` : `<b>🆚 쿠팡 vs 토스 가격차 TOP</b>`);
        for (const { p, coupang, toss, savings } of compares) {
          const { primary } = pickPrimary(p.links, p.price);
          const cheaper = primary?.platform === "toss" ? "토스" : "쿠팡";
          lines.push(
            `· <a href="${escAttr(link(p.slug))}">${escHtml(p.title.slice(0, 40))}</a> — ${cheaper} ${won(Math.min(coupang as number, toss as number))} (<b>${won(savings)} 저렴</b>)`
          );
        }
      }
      if (deals.length > 0 && !evening) {
        lines.push("");
        lines.push(`<b>⚡ 오늘의 딜</b>`);
        for (const p of deals.slice(0, 5)) {
          lines.push(
            `· <a href="${escAttr(link(p.slug))}">${escHtml(p.title.slice(0, 40))}</a>${p.price != null ? ` — ${won(p.price)}` : ""}`
          );
        }
      }
      lines.push("");
      lines.push(`전체 보기 → ${withUtm(`${SITE}/compare`, "telegram", "social", campaign)}`);
      lines.push(
        `<i>쿠팡 파트너스·토스쇼핑 쉐어링크 활동으로 수수료를 받을 수 있습니다. 가격은 발송 시점 기준입니다.</i>`
      );
      telegram = await sendTelegram(lines.join("\n"));
    }

    // ---------- 역대최저가 웹푸시 (아침 회차에만, 있을 때만) ----------
    let push = { sent: 0, removed: 0 };
    if (lows.length > 0 && !evening) {
      try {
        push = await sendPushToAll({
          title: "🔥 역대 최저가 등장!",
          body: `${lows[0].title.slice(0, 30)} ${won(lows[0].price)} 외 ${lows.length}개 상품이 역대 최저가예요.`,
          url: "/deals?utm_source=push&utm_medium=push",
        });
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      message: `알림 완료 — 텔레그램 ${telegram.ok ? "발송 ✓" : `실패(${telegram.error})`}, 역대최저가 ${lows.length}개${lows.length && !evening ? `, 푸시 ${push.sent}명` : ""}${evening ? ` (저녁: 변경 ${compares.length}개)` : ""}`,
      telegram,
      lows: lows.length,
      push,
      evening,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "알림 실패" },
      { status: 502 }
    );
  }
}
