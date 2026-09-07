import { NextResponse } from "next/server";
import { getLink, trackClick, trackClickSource } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 봇 판별용 User-Agent 패턴.
 * robots.txt에서 /go/를 막아뒀지만 이를 무시하는 크롤러·링크 프리뷰·스캐너가
 * 실제로 들어온다(클릭 수가 조회 수보다 많은 상품이 다수 발견됨).
 * 이들을 집계하면 통계가 망가질 뿐 아니라 제휴사 쪽에서 무효 트래픽으로
 * 볼 수 있어, 리다이렉트는 그대로 해주되 집계에서만 제외한다.
 *
 * ⚠️ 메신저 이름을 통째로 넣으면 안 된다. 카카오톡·X(트위터) 인앱 브라우저의 UA에는
 * 각각 "KAKAOTALK", "Twitter for iPhone"이 들어 있어 `kakao`·`twitter` 패턴이
 * **사람의 클릭**을 봇으로 지워버렸다. 카톡으로 링크를 받아 누른 클릭이 전부
 * 0으로 집계되던 원인. 링크 미리보기 수집기(kakaotalk-scrap, Twitterbot,
 * Slackbot, Discordbot, Daumoa …)만 정확히 지목한다.
 */
const BOT_UA =
  /bot|crawler|spider|crawling|slurp|facebookexternalhit|facebot|whatsapp|kakaotalk-scrap|kakaostory|line-poker|embedly|quora|pinterest|applebot|bingpreview|yeti|daumoa|python-requests|curl|wget|okhttp|axios|node-fetch|go-http|java\/|headless|phantom|puppeteer|playwright|lighthouse|gtmetrix|pingdom|uptime|monitor|scan|fetcher|archiver|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot/i;

/** 같은 브라우저의 같은 링크 재클릭은 1시간 동안 집계하지 않는다 (순위 조작·더블클릭 방지) */
const CLICK_DEDUPE_SEC = 3600;

/** ViewTracker가 utm_source를 담아두는 쿠키 (7일) — 채널별 클릭 집계에 쓴다 */
const SOURCE_COOKIE = "ipsomun_src";

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
  const isBot = !ua || BOT_UA.test(ua);

  const cookieHeader = req.headers.get("cookie") || "";
  const dedupeName = `c_${link.id.slice(0, 8)}`;
  const recently = readCookie(cookieHeader, dedupeName) != null;

  const res = NextResponse.redirect(link.url, 302);

  // 클릭 수 집계 (실패해도 리다이렉트는 진행)
  if (!isBot && !recently) {
    const source = readCookie(cookieHeader, SOURCE_COOKIE) || "direct";
    await Promise.allSettled([
      trackClick(link.id, link.productId),
      trackClickSource(source, link.platform),
    ]);
    res.cookies.set(dedupeName, "1", {
      maxAge: CLICK_DEDUPE_SEC,
      path: "/go",
      sameSite: "lax",
      httpOnly: true,
    });
  }

  return res;
}
