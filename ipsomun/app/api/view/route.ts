import { NextResponse } from "next/server";
import { incrementViews } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 같은 브라우저에서 같은 상품은 하루 1회만 집계 */
const DEDUPE_SEC = 24 * 3600;
/** 쿠키 하나에 담아두는 최근 조회 상품 수 (헤더 비대화 방지) */
const COOKIE_NAME = "ipsomun_v";
const MAX_REMEMBERED = 80;

/**
 * 조회수 집계.
 * 상품 페이지를 ISR로 캐싱하면 서버 렌더가 매 방문마다 실행되지 않으므로,
 * 조회수는 클라이언트(ViewTracker)에서 이 엔드포인트로 따로 보고한다.
 *
 * 조회수는 홈·랭킹·검색 정렬 기준이라 curl 루프로 조작할 수 있었다.
 * 교차 출처 요청은 무시하고, 최근 조회 목록 쿠키로 상품당 하루 1회만 센다.
 */
export async function POST(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    return NextResponse.json({ ok: true, skipped: "cross-site" });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });
  }

  const key = id.replace(/-/g, "").slice(0, 8);
  const cookieHeader = req.headers.get("cookie") || "";
  const raw =
    cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.slice(COOKIE_NAME.length + 1) || "";
  const seenList = raw ? raw.split(".").filter(Boolean) : [];
  const seen = seenList.includes(key);

  const res = NextResponse.json({ ok: true, counted: !seen });
  if (!seen) {
    await incrementViews(id).catch(() => {});
    const next = [...seenList, key].slice(-MAX_REMEMBERED).join(".");
    res.cookies.set(COOKIE_NAME, next, {
      maxAge: DEDUPE_SEC,
      path: "/api/view",
      sameSite: "lax",
      httpOnly: true,
    });
  }
  return res;
}
