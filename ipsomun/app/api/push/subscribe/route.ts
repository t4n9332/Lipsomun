import { NextResponse } from "next/server";
import { savePushSubscription } from "@/lib/db";
import { getUserId } from "@/lib/usersession";

export const dynamic = "force-dynamic";

/**
 * 실제 브라우저 푸시 서비스 호스트만 허용.
 * 아무 URL이나 저장되면 (1) 가짜 엔드포인트 대량 등록으로 실제 구독자가 발송 상한에서
 * 밀려나고 (2) 크론마다 Vercel이 임의 서버로 VAPID 서명 POST를 쏘는 발신지가 된다.
 */
const PUSH_HOSTS = [
  /(^|\.)fcm\.googleapis\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
  /(^|\.)push\.samsungosp\.com$/,
  /(^|\.)pushnotify\.dev$/,
];

function validEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    return NextResponse.json({ error: "허용되지 않은 출처" }, { status: 403 });
  }
  const sub = await req.json().catch(() => null);
  if (
    !sub ||
    !validEndpoint(sub.endpoint) ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string"
  ) {
    return NextResponse.json({ error: "잘못된 구독 정보" }, { status: 400 });
  }
  // 로그인 상태면 구독을 계정과 연결 (찜 가격인하 알림용)
  const userId = await getUserId();
  await savePushSubscription(
    { endpoint: sub.endpoint, expirationTime: sub.expirationTime ?? null, keys: sub.keys },
    userId
  );
  return NextResponse.json({ ok: true });
}
