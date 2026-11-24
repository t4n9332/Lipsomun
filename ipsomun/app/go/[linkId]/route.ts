import { NextResponse, after } from "next/server";
import { getLink, trackClick, trackClickSource, trackClickOrigin } from "@/lib/db";
import { BOT_UA } from "@/lib/bot";

export const dynamic = "force-dynamic";

// 봇 판별(BOT_UA)은 lib/bot.ts — 산지직송 클릭 경유(/farm/go)와 함께 쓴다

/** 같은 브라우저의 같은 링크 재클릭은 1시간 동안 집계하지 않는다 (순위 조작·더블클릭 방지) */
const CLICK_DEDUPE_SEC = 3600;

/** ViewTracker가 utm_source를 담아두는 쿠키 (7일) — 채널별 클릭 집계에 쓴다 */
const SOURCE_COOKIE = "ipsomun_src";

/**
 * 클릭이 어디서 눌렸는지 — 링크 마크업을 바꾸지 않고 브라우저가 보내는 헤더로 판단한다.
 * (Referrer-Policy 가 strict-origin-when-cross-origin 이라 같은 사이트 안에서는 전체 경로가 온다)
 *   detail    : 상품 상세(/p/…)에서 누름
 *   list:<첫 경로> : 목록 카드 '구매' 버튼 등 (홈은 list:home)
 *   external  : 다른 사이트·앱에서 /go 로 바로 들어옴 (/r/ 경유 공유 링크 포함)
 *   none      : 주소창·북마크처럼 출처가 전혀 없음 — 사람 손으로는 드물어 봇·본인 의심 지표
 */
function clickOrigin(req: Request): string {
  const site = req.headers.get("sec-fetch-site");
  if (site === "none") return "none";
  if (site !== "same-origin") return "external";
  try {
    const p = new URL(req.headers.get("referer") || "").pathname;
    if (p.startsWith("/p/")) return "detail";
    return "list:" + ((p.split("/")[1] || "home").slice(0, 30));
  } catch {
    return "list:?";
  }
}

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("=") || "");
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params;
  const link = await getLink(linkId).catch(() => null);
  if (!link) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const ua = req.headers.get("user-agent") || "";
  // UA가 아예 없는 요청도 정상 브라우저가 아니다
  // Sec-Fetch-Site 가 없으면 브라우저 이동이 아니다(스크립트 반복 호출로 클릭 수 조작 방지).
  // 이동은 그대로 시켜 주고 집계만 뺀다.
  const isBot = !ua || BOT_UA.test(ua) || !req.headers.get("sec-fetch-site");

  const cookieHeader = req.headers.get("cookie") || "";
  const dedupeName = `c_${link.id.slice(0, 8)}`;
  const recently = readCookie(cookieHeader, dedupeName) != null;

  const res = NextResponse.redirect(link.url, 302);

  // 클릭 수 집계 (실패해도 리다이렉트는 진행)
  if (!isBot && !recently) {
    const source = readCookie(cookieHeader, SOURCE_COOKIE) || "direct";
    const origin = clickOrigin(req);
    // 집계는 응답을 보낸 뒤에 한다 — DB 지연만큼 쇼핑몰 이동이 늦어지면 전환을 잃는다
    after(() =>
      Promise.allSettled([
        trackClick(link.id, link.productId),
        trackClickSource(source, link.platform),
        trackClickOrigin(origin, link.platform),
      ]),
    );
    res.cookies.set(dedupeName, "1", {
      maxAge: CLICK_DEDUPE_SEC,
      path: "/go",
      sameSite: "lax",
      httpOnly: true,
    });
  }

  return res;
}
