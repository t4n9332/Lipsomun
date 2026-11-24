import { NextResponse, after } from "next/server";
import farm from "@/data/farm.json";
import { trackClickOrigin } from "@/lib/db";
import { isBotRequest } from "@/lib/bot";

export const dynamic = "force-dynamic";

/**
 * 산지직송 상품 → 네이버 스마트스토어 이동 경유지 (2026-11-24).
 * 어디서 눌렸는지(from)를 click_origins 에 'farm:<from>' 으로 쌓아, 관리자 '클릭 위치' 표에서
 * 교차 노출(상품 상세·카테고리)이 실제로 스토어 방문을 만드는지 본다. 이동은 봇이어도 그대로 시킨다.
 *   from: xsell(상품 상세 교차 노출) · cat(카테고리 배너) · farm(산지직송 코너)
 */
const FROM = new Set(["xsell", "cat", "farm"]);
const DEDUPE_SEC = 3600;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = (farm.items as { id: string; naver_url: string }[]).find((i) => i.id === id);
  if (!item?.naver_url) return NextResponse.redirect(new URL("/farm", req.url));

  const fromRaw = new URL(req.url).searchParams.get("from") || "farm";
  const from = FROM.has(fromRaw) ? fromRaw : "farm";
  const res = NextResponse.redirect(item.naver_url, 302);

  const dedupe = `f_${id.slice(-8)}`;
  const recently = (req.headers.get("cookie") || "").includes(`${dedupe}=`);
  if (!isBotRequest(req) && !recently) {
    after(() => trackClickOrigin(`farm:${from}`, "farm").catch(() => {}));
    res.cookies.set(dedupe, "1", { maxAge: DEDUPE_SEC, path: "/farm/go", sameSite: "lax", httpOnly: true });
  }
  return res;
}
