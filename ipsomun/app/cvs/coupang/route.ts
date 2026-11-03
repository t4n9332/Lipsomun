import { NextResponse } from "next/server";
import { createDeeplinks } from "@/lib/coupang";
import { getCvsCoupangLink, saveCvsCoupangLink } from "@/lib/db";

/**
 * 편의점 행사 상품 → 쿠팡 검색 결과(대용량·박스 구매 비교)로 보내는 제휴 이동.
 *
 * 편의점 행사 페이지는 트래픽은 생기지만 그 자체로는 수익이 없다. 같은 상품을 쿠팡에서
 * 박스로 사면 더 싼 경우가 많아, 쿠팡 검색 페이지를 파트너스 딥링크로 바꿔 보낸다.
 * 딥링크는 검색어별로 DB 에 저장해 API 호출을 아낀다. 실패하면 일반 검색으로라도 보낸다.
 */
export const dynamic = "force-dynamic";

const BOT_UA = /bot|crawler|spider|slurp|facebookexternalhit|kakaotalk-scrap|yeti|daumoa|curl|wget|python|headless|lighthouse|gptbot|claudebot/i;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 60);
  const plain = `https://www.coupang.com/np/search?q=${encodeURIComponent(q)}`;
  if (!q) return NextResponse.redirect("https://www.coupang.com/", 302);

  // 봇·미리보기는 API 를 쓰지 않는다 (호출 한도 보호)
  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOT_UA.test(ua)) return NextResponse.redirect(plain, 302);

  try {
    const cached = await getCvsCoupangLink(q);
    if (cached) return NextResponse.redirect(cached, 302);
    const [d] = await createDeeplinks([plain]);
    const url = d?.shortenUrl || d?.landingUrl;
    if (url) {
      await saveCvsCoupangLink(q, url).catch(() => {});
      return NextResponse.redirect(url, 302);
    }
  } catch (e) {
    console.error("[cvs/coupang] 딥링크 실패:", e instanceof Error ? e.message : e);
  }
  return NextResponse.redirect(plain, 302);
}
