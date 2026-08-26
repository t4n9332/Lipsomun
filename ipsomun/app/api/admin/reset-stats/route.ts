import { NextResponse } from "next/server";
import { resetStats } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * 클릭·조회 통계 초기화 (되돌릴 수 없음).
 * body: { confirm: "RESET" }
 *
 * 봇 필터 도입 전 수치는 크롤러가 상품마다 링크를 하나씩 따라간 값이 섞여 있어
 * 실제 인기도를 알 수 없다. 실수로 호출되지 않도록 확인 문자열을 요구한다.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (body?.confirm !== "RESET") {
    return NextResponse.json(
      { error: '되돌릴 수 없는 작업입니다. body에 {"confirm":"RESET"}을 보내세요.' },
      { status: 400 }
    );
  }

  const result = await resetStats();
  revalidatePath("/");
  revalidatePath("/ranking");
  return NextResponse.json({ ok: true, ...result });
}
