import { NextResponse } from "next/server";
import { stampAttendance, getAttendanceStats } from "@/lib/db";
import { getUserId } from "@/lib/usersession";
import { levelOf, nextLevel } from "@/lib/levels";

export const dynamic = "force-dynamic";

/** 오늘 출석 도장 찍기 */
export async function POST() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const stamped = await stampAttendance(userId);
  const stats = await getAttendanceStats(userId);

  return NextResponse.json({
    stamped, // false면 오늘 이미 출석함
    stats,
    level: levelOf(stats.total),
    next: nextLevel(stats.total),
  });
}
