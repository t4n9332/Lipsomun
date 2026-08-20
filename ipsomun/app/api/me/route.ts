import { NextResponse } from "next/server";
import { getUser, getAttendanceStats } from "@/lib/db";
import { getUserId } from "@/lib/usersession";
import { levelOf, nextLevel } from "@/lib/levels";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ user: null });

  const user = await getUser(userId);
  if (!user) return NextResponse.json({ user: null });

  const stats = await getAttendanceStats(userId);
  const level = levelOf(stats.total);
  const next = nextLevel(stats.total);

  return NextResponse.json({
    user: { name: user.name, email: user.email, picture: user.picture },
    stats,
    level,
    next,
  });
}
