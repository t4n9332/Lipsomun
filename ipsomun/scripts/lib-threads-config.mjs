/**
 * 스레드 자동 게시 설정 보관 (2026-11-24)
 * scripts/.threads-config.json = { appId, appSecret(암호), userId, username, token(암호), expiresAt, tokenSavedAt }
 * 비밀값은 Windows DPAPI(CurrentUser)로 암호화 — 이 PC 의 이 Windows 계정에서만 풀린다(lib-toss-cred.mjs 와 같은 방식).
 * 등록:  node scripts/threads-setup.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { protectSecret, unprotectSecret } from "./lib-toss-cred.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const THREADS_CONFIG_PATH = path.join(__dirname, ".threads-config.json");

export function readRaw() {
  try {
    return JSON.parse(readFileSync(THREADS_CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeRaw(o) {
  writeFileSync(THREADS_CONFIG_PATH, JSON.stringify(o, null, 2));
}

export function saveApp(appId, appSecret) {
  writeRaw({ ...readRaw(), appId, appSecret: protectSecret(appSecret) });
}

export function loadApp() {
  const c = readRaw();
  if (!c.appId || !c.appSecret) return null;
  return { appId: c.appId, appSecret: unprotectSecret(c.appSecret) };
}

export function saveToken({ userId, username, accessToken, expiresAt }) {
  writeRaw({
    ...readRaw(),
    ...(userId ? { userId } : {}),
    ...(username ? { username } : {}),
    token: protectSecret(accessToken),
    expiresAt,
    tokenSavedAt: new Date().toISOString(),
  });
}

/** @returns {{ userId: string, username: string, accessToken: string, expiresAt: string, tokenSavedAt: string } | null} */
export function loadToken() {
  if (!existsSync(THREADS_CONFIG_PATH)) return null;
  const c = readRaw();
  if (!c.token || !c.userId) return null;
  return {
    userId: c.userId,
    username: c.username || "",
    accessToken: unprotectSecret(c.token),
    expiresAt: c.expiresAt,
    tokenSavedAt: c.tokenSavedAt,
  };
}
