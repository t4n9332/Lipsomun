import { NextResponse } from "next/server";
import { getLink, trackClick } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 봇 판별용 User-Agent 패턴.
 * robots.txt에서 /go/를 막아뒀지만 이를 무시하는 크롤러·링크 프리뷰·스캐너가
 * 실제로 들어온다(클릭 수가 조회 수보다 많은 상품이 다수 발견됨).
 * 이들을 집계하면 통계가 망가질 뿐 아니라 제휴사 쪽에서 무효 트래픽으로
 * 볼 수 있어, 리다이렉트는 그대로 해주되 집계에서만 제외한다.
 */
const BOT_UA =
  /bot|crawler|spider|crawling|slurp|facebookexternalhit|facebot|whatsapp|telegram|discord|slack|twitter|kakao|line-poker|embedly|quora|pinterest|redditbot|applebot|bingpreview|yeti|daum|python-requests|curl|wget|okhttp|axios|node-fetch|go-http|java\/|headless|phantom|puppeteer|playwright|lighthouse|gtmetrix|pingdom|uptime|monitor|scan|preview|fetcher|archiver|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot/i;

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

  // 클릭 수 집계 (실패해도 리다이렉트는 진행)
  if (!isBot) {
    await trackClick(link.id, link.productId).catch(() => {});
  }

  return NextResponse.redirect(link.url, 302);
}
