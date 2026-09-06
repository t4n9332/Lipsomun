import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "ipsomun_admin";

function token(): string {
  const pw = process.env.ADMIN_PASSWORD || "";
  return crypto.createHash("sha256").update("ipsomun:" + pw).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === token();
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
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  return notCrossSite(req) && (await isAdmin());
}

export async function login(password: string): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
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
