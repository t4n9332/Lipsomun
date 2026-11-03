import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "ipsomun_user";

function secret(): string {
  // AUTH_SECRET이 없으면 ADMIN_PASSWORD 기반으로 파생 (설정 단순화).
  // 둘 다 없으면 서명 키가 공개 문자열("derive:")이 되어 아무 세션이나 위조할 수 있으므로 막는다.
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.ADMIN_PASSWORD) return "derive:" + process.env.ADMIN_PASSWORD;
  throw new Error("AUTH_SECRET 미설정 — 회원 세션을 서명할 수 없습니다");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex").slice(0, 32);
}

export async function setUserSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, userId + "." + sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}

export async function getUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  let expected: string;
  try {
    expected = sign(id);
  } catch {
    return null;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return id;
}

export async function clearUserSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
