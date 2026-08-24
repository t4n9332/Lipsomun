import { NextResponse } from "next/server";
import {
  getDeals,
  getPriceCompareProducts,
  getAllTimeLows,
  type ProductWithLinks,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { sendTelegram, escHtml, telegramConfigured } from "@/lib/telegram";
import { sendPushToAll } from "@/lib/push";
import { won } from "@/lib/util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

function effPrices(p: ProductWithLinks): { coupang: number | null; toss: number | null } {
  const c = p.links.find((l) => l.platform === "coupang");
  const t = p.links.find((l) => l.platform === "toss");
  return { coupang: c ? (c.price ?? p.price) : null, toss: t ? t.price : null };
}

/**
 * 일일 특가 다이제스트 — 텔레그램 채널 발송 + 역대최저가 웹푸시.
 * 매일 자동 매칭(toss-playwright --auto) 직후 호출됨.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const cronOk =
    !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk && !(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }

  try {
    const [deals, compareAll, lows] = await Promise.all([
      getDeals(5),
      getPriceCompareProducts(60),
      getAllTimeLows(5).catch(() => []),
    ]);

    const compares = compareAll
      .map((p) => {
        const { coupang, toss } = effPrices(p);
        const savings =
          coupang != null && toss != null ? Math.abs(coupang - toss) : 0;
        return { p, coupang, toss, savings };
      })
      .filter((x) => x.savings > 0)
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 5);

    // ---------- 텔레그램 다이제스트 ----------
    let telegram: { ok: boolean; error?: string } = {
      ok: false,
      error: "텔레그램 미설정",
    };
    if (telegramConfigured()) {
      const lines: string[] = [];
      lines.push(`<b>🛒 입소문 오늘의 특가 브리핑</b>`);
      if (lows.length > 0) {
        lines.push("");
        lines.push(`<b>🔥 역대 최저가 진입!</b>`);
        for (const p of lows) {
          lines.push(
            `· <a href="${SITE}/p/${encodeURIComponent(p.slug)}">${escHtml(p.title.slice(0, 45))}</a> — <b>${won(p.price)}</b>`
          );
        }
      }
      if (compares.length > 0) {
        lines.push("");
        lines.push(`<b>🆚 쿠팡 vs 토스 가격차 TOP</b>`);
        for (const { p, coupang, toss, savings } of compares) {
          const cheaper = (toss as number) < (coupang as number) ? "토스" : "쿠팡";
          lines.push(
            `· <a href="${SITE}/p/${encodeURIComponent(p.slug)}">${escHtml(p.title.slice(0, 40))}</a> — ${cheaper} ${won(Math.min(coupang as number, toss as number))} (<b>${won(savings)} 저렴</b>)`
          );
        }
      }
      if (deals.length > 0) {
        lines.push("");
        lines.push(`<b>⚡ 오늘의 딜</b>`);
        for (const p of deals.slice(0, 5)) {
          lines.push(
            `· <a href="${SITE}/p/${encodeURIComponent(p.slug)}">${escHtml(p.title.slice(0, 40))}</a>${p.price != null ? ` — ${won(p.price)}` : ""}`
          );
        }
      }
      lines.push("");
      lines.push(`전체 보기 → ${SITE}/compare`);
      lines.push(
        `<i>쿠팡 파트너스·토스쇼핑 쉐어링크 활동으로 수수료를 받을 수 있습니다. 가격은 발송 시점 기준입니다.</i>`
      );
      telegram = await sendTelegram(lines.join("\n"));
    }

    // ---------- 역대최저가 웹푸시 (있을 때만) ----------
    let push = { sent: 0, removed: 0 };
    if (lows.length > 0) {
      try {
        push = await sendPushToAll({
          title: "🔥 역대 최저가 등장!",
          body: `${lows[0].title.slice(0, 30)} ${won(lows[0].price)} 외 ${lows.length}개 상품이 역대 최저가예요.`,
          url: "/deals",
        });
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      message: `알림 완료 — 텔레그램 ${telegram.ok ? "발송 ✓" : `실패(${telegram.error})`}, 역대최저가 ${lows.length}개${lows.length ? `, 푸시 ${push.sent}명` : ""}`,
      telegram,
      lows: lows.length,
      push,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "알림 실패" },
      { status: 502 }
    );
  }
}
