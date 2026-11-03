import { NextResponse } from "next/server";
import { claimDailyRun, releaseDailyRun } from "@/lib/db";
import { cronOrAdmin } from "@/lib/auth";
import { sendTelegram, escHtml, telegramConfigured } from "@/lib/telegram";
import { brandName, monthLabel, unitPrice } from "@/lib/cvs";
import { CUR, HAS_PREV, CHANGES, CROSS, CATEGORY_COUNTS } from "@/lib/cvsData";
import { won, withUtm } from "@/lib/util";

/**
 * 매월 1일 편의점 행사 텔레그램 브리핑.
 * 수집 워크플로(.github/workflows/cvs-monthly.yml)가 데이터를 커밋하고 새 배포가 뜬 뒤 호출한다.
 * 데이터는 빌드에 묶여 있으므로, 이 배포의 데이터가 아직 이번 달이 아니면 409 로 돌려보내
 * 워크플로가 잠시 뒤 다시 부르게 한다. 달마다 한 번만 보낸다(cron_runs 도장).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

export async function GET(req: Request) {
  if (!(await cronOrAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const kstMonth = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
  if (CUR.month !== kstMonth || CUR.items.length === 0) {
    return NextResponse.json(
      { ok: false, retry: true, message: `배포된 데이터가 ${CUR.month || "없음"} — 이번 달(${kstMonth}) 배포를 기다리는 중` },
      { status: 409 }
    );
  }
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, message: "텔레그램 미설정" }, { status: 500 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  const job = `cvs-notify:${CUR.month}`;
  // 날짜 도장 대신 '달' 이름으로 — 1일에 실패해 2일에 다시 불러도 한 번만 나간다
  if (!force && !(await claimDailyRun(job, `${CUR.month}-01`).catch(() => true))) {
    return NextResponse.json({ ok: true, skipped: true, message: "이번 달 이미 발송함" });
  }

  const M = monthLabel(CUR.month);
  const link = (path: string) => withUtm(`${SITE}${path}`, "telegram", "social", `cvs-${CUR.month}`);
  const lines: string[] = [`🏪 <b>${M} 편의점 행사 총정리</b>`, `CU·세븐일레븐·이마트24 1+1·2+1 ${CUR.items.length.toLocaleString("ko-KR")}개`, ""];

  const cross = CROSS.filter((x) => x.save > 0).slice(0, 5);
  if (cross.length) {
    lines.push("🆚 <b>같은 상품, 여기서 사면 이득</b>");
    for (const x of cross) {
      const w = x.offers[0];
      const l = x.offers[x.offers.length - 1];
      lines.push(
        `• ${escHtml(x.name)} — <b>${brandName(w.b)} ${w.t}</b> 1개당 ${won(unitPrice(w))} (${brandName(l.b)} ${l.t} ${won(unitPrice(l))})`
      );
    }
    lines.push(`전체 비교 → ${link("/cvs/compare")}`, "");
  }

  if (HAS_PREV) {
    const buffs = CHANGES.filter((c) => c.kind === "buff" && c.typeChanged).slice(0, 3);
    const nerfs = CHANGES.filter((c) => c.kind === "nerf" && c.typeChanged).slice(0, 3);
    if (buffs.length || nerfs.length) {
      lines.push("🎮 <b>이번 달 패치노트</b>");
      for (const c of buffs) lines.push(`▲ ${brandName(c.b)} ${escHtml(c.n)} ${c.before?.t} → <b>${c.after?.t}</b>`);
      for (const c of nerfs) lines.push(`▼ ${brandName(c.b)} ${escHtml(c.n)} ${c.before?.t} → ${c.after?.t}`);
      lines.push(`전체 패치노트 → ${link("/cvs/patch")}`, "");
    }
  }

  const cats = CATEGORY_COUNTS.filter((x) => x.count > 0 && x.c !== "기타").slice(0, 4);
  lines.push(
    "📂 분류별 1개당 최저가: " +
      cats.map((x) => `<a href="${link(`/cvs/c/${encodeURIComponent(x.slug)}`)}">${x.c}</a>`).join(" · ")
  );
  lines.push("", `<i>각 편의점 공식 홈페이지 행사 안내 기준. 매장별로 다를 수 있습니다. GS25는 공식 웹 목록 미제공.</i>`);

  const r = await sendTelegram(lines.join("\n"));
  if (!r.ok && !force) await releaseDailyRun(job, `${CUR.month}-01`).catch(() => {});
  return NextResponse.json({ ok: r.ok, error: r.error, month: CUR.month }, { status: r.ok ? 200 : 502 });
}
