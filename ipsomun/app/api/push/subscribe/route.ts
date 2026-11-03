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

/** base64url 키를 디코드했을 때 길이가 정확히 맞는지 (p256dh 65바이트, auth 16바이트) */
function validKey(v: unknown, bytes: number): boolean {
  if (typeof v !== "string" || v.length > 200 || !/^[A-Za-z0-9_-]+=*$/.test(v)) return false;
  return Buffer.from(v, "base64url").length === bytes;
}

export async function POST(req: Request) {
  // 브라우저의 구독 요청에는 항상 Sec-Fetch-Site 가 붙는다. 헤더가 없는 요청(curl 등)은
  // 가짜 구독을 대량으로 넣어 실제 구독자를 발송 대상에서 밀어낼 수 있어 거절한다.
  const site = req.headers.get("sec-fetch-site");
  if (site !== "same-origin") {
    return NextResponse.json({ error: "허용되지 않은 출처" }, { status: 403 });
  }
  const sub = await req.json().catch(() => null);
  if (
    !sub ||
    !validEndpoint(sub.endpoint) ||
    !validKey(sub.keys?.p256dh, 65) ||
    !validKey(sub.keys?.auth, 16)
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
