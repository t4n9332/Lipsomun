import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "ipsomun_admin";

/**
 * 관리자 쿠키 값 = sha256("ipsomun:" + ADMIN_PASSWORD [+ ":" + ADMIN_TOKEN_SECRET]).
 * 비밀번호만으로 유도하면 쿠키가 유출됐을 때 비밀번호를 바꾸기 전엔 영영 유효하다.
 * ADMIN_TOKEN_SECRET(선택)을 두면 그 값만 바꿔 발급된 쿠키를 전부 무효화할 수 있다.
 * 로컬 스크립트(scripts/*.mjs)는 .toss-config.json의 tokenSecret으로 같은 값을 만든다 —
 * Vercel에 ADMIN_TOKEN_SECRET을 넣을 때 그 파일에도 같이 넣어야 자동화가 안 끊긴다.
 */
function token(): string {
  const pw = process.env.ADMIN_PASSWORD || "";
  const secret = process.env.ADMIN_TOKEN_SECRET || "";
  return crypto
    .createHash("sha256")
    .update("ipsomun:" + pw + (secret ? ":" + secret : ""))
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function isAdmin(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  const store = await cookies();
  const v = store.get(COOKIE_NAME)?.value;
  return !!v && safeEqual(v, token());
}
/**
 * 관리자 쿠키만으로 통과되는 GET 라우트(크론 수동 실행·대량 등록)의 CSRF 방어.
 * SameSite=Lax 쿠키는 다른 사이트의 링크 클릭(최상위 GET)에도 함께 전송되므로,
 * 브라우저가 붙이는 Sec-Fetch-Site가 cross-site/same-site(서브도메인)면 거절한다.
 * 헤더가 없는 요청(로컬 스크립트·구버전 브라우저)과 주소창 직접 입력(none)·
 * 사이트 내부 fetch(same-origin)는 그대로 통과한다.
 */
export function notCrossSite(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

/** 크론 시크릿(Bearer) 또는 '출처가 의심스럽지 않은' 관리자 쿠키 */
export async function cronOrAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && safeEqual(auth, `Bearer ${process.env.CRON_SECRET}`)) return true;
  return notCrossSite(req) && (await isAdmin());
}

export async function login(password: string): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
    return false;
  }
  const store = await cookies();
  store.set(COOKIE_NAME, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return true;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
