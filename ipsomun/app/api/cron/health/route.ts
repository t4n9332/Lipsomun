import { NextResponse } from "next/server";
import { cronOrAdmin } from "@/lib/auth";
import { q, kstToday, claimDailyRun } from "@/lib/db";
import { sendTelegram, escHtml } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * 자동화 감시. 각 파이프라인은 실패해도 조용하다 — PC가 꺼지면 로그조차 안 남고,
 * 크론 엔드포인트는 건너뛰어도 200을 준다. 그래서 '결과물이 오늘 생겼는가'를 DB에서 직접 본다.
 * 문제가 있으면 텔레그램으로 하루 한 번 알린다. GitHub Actions(13:00 KST)가 호출한다.
 */
export async function GET(req: Request) {
  if (!(await cronOrAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const today = kstToday();
  const kstHour = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
  const problems: string[] = [];

  const [beat] = await q(
    `SELECT max(day)::text AS day FROM cron_runs WHERE job = 'toss-local'`
  );
  // 로컬 첫 회차는 09:30 — 정오 전에는 아직 안 돌았을 수 있다
  if (kstHour >= 12 && beat?.day !== today) {
    problems.push(
      `로컬 자동화(토스 매칭·가격갱신)가 오늘 한 번도 성공하지 못했습니다` +
        ` (마지막 성공: ${beat?.day ?? "기록 없음"}). PC 전원·작업 스케줄러·토스 로그인을 확인하세요.`
    );
  }

  const [snap] = await q(`SELECT count(*)::int AS n FROM price_history WHERE day = $1::date`, [today]);
  if (kstHour >= 9 && !snap?.n) {
    problems.push("오늘 가격 스냅샷이 없습니다 (07:00 골드박스 크론 실패 — 역대최저가·가격 추이가 결번됩니다).");
  }

  const [post] = await q(
    `SELECT extract(epoch FROM now() - max(updated_at))::int AS age FROM posts`
  );
  if (post?.age != null && post.age > 36 * 3600) {
    problems.push(`블로그 리포트가 ${Math.round(post.age / 3600)}시간째 갱신되지 않았습니다.`);
  }

  const [stats] = await q(
    `SELECT
       (SELECT count(*)::int FROM products WHERE is_published) AS published,
       (SELECT count(*)::int FROM products p WHERE p.is_published
          AND EXISTS (SELECT 1 FROM affiliate_links l WHERE l.product_id = p.id AND l.platform = 'coupang')
          AND EXISTS (SELECT 1 FROM affiliate_links l WHERE l.product_id = p.id AND l.platform = 'toss')) AS compare`
  );

  let alerted = false;
  if (problems.length && (await claimDailyRun("health-alert"))) {
    const r = await sendTelegram(
      `🩺 <b>입소문 자동화 점검</b>\n` + problems.map((p) => `• ${escHtml(p)}`).join("\n")
    );
    alerted = r.ok;
  }
  return NextResponse.json({ ok: problems.length === 0, problems, alerted, lastLocalRun: beat?.day ?? null, ...stats });
}
