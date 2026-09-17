import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { q, kstToday } from "@/lib/db";

export const dynamic = "force-dynamic";

const JOBS = new Set(["toss-local"]);

/**
 * 로컬 자동화가 회차를 '성공'으로 끝냈을 때 찍는 도장. /api/cron/health가 이 도장의
 * 유무로 PC 꺼짐·스케줄러 고장·세션 만료를 한꺼번에 감지한다.
 * body: { job }
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const job = String(body?.job || "");
  if (!JOBS.has(job)) {
    return NextResponse.json({ error: "알 수 없는 job" }, { status: 400 });
  }
  await q(
    `INSERT INTO cron_runs (day, job) VALUES ($1::date, $2)
     ON CONFLICT (day, job) DO UPDATE SET created_at = now()`,
    [kstToday(), job]
  );
  return NextResponse.json({ ok: true });
}
