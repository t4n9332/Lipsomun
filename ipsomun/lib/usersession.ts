import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "ipsomun_user";

function secret(): string {
  // AUTH_SECRET이 없으면 ADMIN_PASSWORD 기반으로 파생 (설정 단순화)
  return process.env.AUTH_SECRET || "derive:" + (process.env.ADMIN_PASSWORD || "");
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
  if (sign(id) !== sig) return null;
  return id;
}

export async function clearUserSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
