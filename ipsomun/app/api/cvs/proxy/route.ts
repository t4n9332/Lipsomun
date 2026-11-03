import { NextResponse } from "next/server";

/**
 * 편의점 행사 수집용 중계 — 서울 리전에서 대신 받아 준다.
 *
 * 세븐일레븐 홈페이지는 해외 IP(GitHub Actions 는 미국)에서 접속하면 연결 자체가 막힌다
 * (2026-11 확인: UND_ERR_CONNECT_TIMEOUT). 그래서 수집 스크립트가 직접 실패하면 이 라우트를
 * 거쳐 한국(icn1)에서 요청한다.
 *
 * 남용 방지: CRON_SECRET(Bearer) 필수, 허용한 편의점 호스트로만 요청, 응답 크기 제한.
 *
 * Edge 런타임인 이유: 일반(Node) 함수는 요금제에 따라 preferredRegion 이 무시돼 미국(iad1)에서
 * 실행됐다(2026-11-03 실측). Edge 함수는 지정한 리전에서 돈다.
 */
export const runtime = "edge";
export const preferredRegion = "icn1";
export const dynamic = "force-dynamic";

/** 길이가 같을 때 끝까지 비교하는 상수 시간 비교 (Edge 에는 crypto.timingSafeEqual 이 없다) */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const ALLOWED_HOSTS = new Set([
  "www.7-eleven.co.kr",
  "gs25.gsretail.com",
  "cu.bgfretail.com",
  "emart24.co.kr",
]);
const MAX_BYTES = 3_000_000;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") || "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } | null;
  let target: URL;
  try {
    target = new URL(String(body?.url));
  } catch {
    return NextResponse.json({ error: "url 이 필요합니다" }, { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "허용되지 않은 주소" }, { status: 400 });
  }
  const method = body?.method === "POST" ? "POST" : "GET";
  // 쿠키·Referer·Content-Type 정도만 넘긴다 (임의 헤더 주입 방지)
  const pass: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9",
  };
  for (const k of ["Content-Type", "Referer", "Cookie", "X-Requested-With", "Accept"]) {
    const v = body?.headers?.[k];
    if (typeof v === "string" && v.length < 4000) pass[k] = v;
  }
  try {
    const res = await fetch(target, {
      method,
      headers: pass,
      body: method === "POST" ? String(body?.body ?? "") : undefined,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const text = (await res.text()).slice(0, MAX_BYTES);
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "text/plain; charset=utf-8",
        "X-Proxy-Region": process.env.VERCEL_REGION || "unknown",
        "X-Upstream-Set-Cookie": (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; "),
      },
    });
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    return NextResponse.json(
      { error: `중계 실패: ${err.message} ${err.cause?.code || ""}`, region: process.env.VERCEL_REGION || "unknown" },
      { status: 502 }
    );
  }
}
