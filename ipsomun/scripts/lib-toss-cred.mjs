/**
 * 토스 쉐어링크 자동 로그인 (2026-11-24)
 *
 * 세션은 토스 서버가 2시간~4일 간격으로 끊는다. 끊길 때마다 운영자가 직접 로그인하던 것을,
 * 저장해 둔 계정으로 회차가 스스로 로그인하게 한다.
 *
 * 보관: scripts/.toss-cred.json = { id, secret, savedAt }
 *   secret 은 Windows DPAPI(CurrentUser)로 암호화한 비밀번호 — 이 PC 의 이 Windows 계정에서만 풀린다.
 *   평문은 메모리에만 있고 파일·로그·프로세스 인자(명령줄)에 남기지 않는다(PowerShell 과는 표준입력으로 주고받음).
 *   등록·변경:  node scripts/toss-cred.mjs
 *
 * 안전장치 (scripts/.toss-autologin.json):
 *   - 로그인 화면에 그대로 머무르면(비밀번호 틀림 등) 즉시 '중지' — 계정 잠금을 막기 위해 재시도하지 않는다.
 *     다시 켜려면 toss-cred.mjs 로 다시 저장.
 *   - 보안문자(CAPTCHA)가 나오면 우회하지 않고 24시간 쉰다.
 *   - 토스 앱 확인·문자 인증 같은 추가 인증은 운영자 몫 — PC 알림을 띄우고 3분 기다린 뒤, 안 되면 6시간 쉰다
 *     (2시간마다 휴대폰에 인증 요청이 쌓이지 않게).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CRED_PATH = path.join(__dirname, ".toss-cred.json");
export const AUTOLOGIN_STATE_PATH = path.join(__dirname, ".toss-autologin.json");

const SHARELINK_HOME = "https://sharelink.toss.im/home";
const HOUR = 3600 * 1000;
const BACKOFF_VERIFY_MS = 6 * HOUR;
const BACKOFF_CAPTCHA_MS = 24 * HOUR;
const VERIFY_WAIT_MS = 3 * 60 * 1000;

/* ---------- DPAPI (Windows PowerShell 5.1 + .NET ProtectedData) ---------- */

function runPs(script, stdinText) {
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
    { input: stdinText, encoding: "utf8", timeout: 20000, windowsHide: true }
  );
  if (r.status !== 0) throw new Error(`DPAPI 처리 실패 (${(r.stderr || "").trim().split("\n")[0] || r.status})`);
  return (r.stdout || "").trim();
}

const PS_PROTECT =
  "Add-Type -AssemblyName System.Security; " +
  "$b = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); " +
  "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b, $null, 'CurrentUser'))";
const PS_UNPROTECT =
  "Add-Type -AssemblyName System.Security; " +
  "$b = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); " +
  "[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($b, $null, 'CurrentUser'))";

export function protectSecret(plain) {
  return runPs(PS_PROTECT, Buffer.from(plain, "utf8").toString("base64"));
}

export function unprotectSecret(blob) {
  return Buffer.from(runPs(PS_UNPROTECT, blob), "base64").toString("utf8");
}

/* ---------- 저장 정보 ---------- */

export function saveCred(id, password) {
  writeFileSync(
    CRED_PATH,
    JSON.stringify({ id, secret: protectSecret(password), savedAt: new Date().toISOString() }, null, 2)
  );
  // 새로 저장하면 이전 '중지'·대기 상태를 풀어 준다
  writeState({ savedAt: new Date().toISOString() });
}

export function hasCred() {
  try {
    const c = JSON.parse(readFileSync(CRED_PATH, "utf8"));
    return Boolean(c.id && c.secret);
  } catch {
    return false;
  }
}

function loadCred() {
  const c = JSON.parse(readFileSync(CRED_PATH, "utf8"));
  return { id: c.id, password: unprotectSecret(c.secret) };
}

/* ---------- 시도 기록 ---------- */

export function readState() {
  try {
    return JSON.parse(readFileSync(AUTOLOGIN_STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeState(s) {
  try {
    writeFileSync(AUTOLOGIN_STATE_PATH, JSON.stringify(s, null, 2));
  } catch {}
}

function record(result, extra = {}) {
  const prev = readState();
  writeState({ ...prev, lastAttempt: new Date().toISOString(), lastResult: result, ...extra });
}

/* ---------- 로그인 ---------- */

async function onDashboard(page) {
  try {
    if (!page.url().startsWith("https://sharelink.toss.im/")) return false;
    return await page.evaluate(() => document.body.innerText.includes("실적 대시보드"));
  } catch {
    return false;
  }
}

async function bodyText(page) {
  try {
    return (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function waitDashboard(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await onDashboard(page)) return true;
    // 로그인 직후 sharelink 가 signup-start 등을 거쳐 홈으로 가므로, 토스 밖 화면이 아니면 한 번씩 홈을 연다
    if (page.url().startsWith("https://sharelink.toss.im/") && !page.url().startsWith(SHARELINK_HOME)) {
      await page.goto(SHARELINK_HOME, { waitUntil: "domcontentloaded" }).catch(() => {});
    }
    await page.waitForTimeout(3000);
  }
  return onDashboard(page);
}

/**
 * 저장된 계정으로 로그인을 시도한다. 예외를 던지지 않는다.
 * @param page  launchPersistentContext(.toss-profile) 의 페이지 — 성공하면 세션이 프로필에 저장된다
 * @param opts.force  대기·중지 상태를 무시 (toss-cred.mjs 의 등록 직후 시험용)
 * @param opts.onVerify  추가 인증이 필요할 때 부르는 콜백(PC 알림 등)
 * @returns {{ ok: boolean, tried: boolean, why: string }}
 */
export async function tryAutoLogin(page, { force = false, onVerify } = {}) {
  if (!hasCred()) return { ok: false, tried: false, why: "자동 로그인 정보 없음(node scripts/toss-cred.mjs 로 등록)" };
  const st = readState();
  if (!force) {
    if (st.disabled) return { ok: false, tried: false, why: `자동 로그인 중지됨: ${st.disabled}` };
    if (st.retryAfter && Date.now() < Date.parse(st.retryAfter)) {
      return { ok: false, tried: false, why: `자동 로그인 대기 중(${st.lastResult || "?"}, ${st.retryAfter} 이후 재시도)` };
    }
  }

  let cred;
  try {
    cred = loadCred();
  } catch (e) {
    record("복호화 실패", { disabled: `저장 정보를 풀 수 없음 — 다시 저장 필요 (${e.message})` });
    return { ok: false, tried: false, why: "저장된 비밀번호를 풀 수 없음(다른 Windows 계정·PC?) — toss-cred.mjs 로 다시 저장" };
  }

  try {
    await page.goto(SHARELINK_HOME, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    if (await onDashboard(page)) {
      record("이미 로그인됨", { retryAfter: null });
      return { ok: true, tried: false, why: "이미 로그인됨" };
    }

    const email = page.locator('input[name="email"]');
    const pw = page.locator('input[name="password"]');
    if (!(await email.count()) || !(await pw.count())) {
      // 화면이 바뀌었으면 엉뚱한 곳에 입력하지 않는다
      record("로그인 화면 아님", { retryAfter: new Date(Date.now() + BACKOFF_VERIFY_MS).toISOString(), url: page.url() });
      return { ok: false, tried: false, why: `토스 로그인 화면 구조가 다름(${page.url().slice(0, 80)})` };
    }
    await email.first().fill(cred.id);
    await pw.first().fill(cred.password);
    await page.locator('button[type="submit"]').first().click();
    cred = null;

    if (await waitDashboard(page, 20000)) {
      record("성공", { retryAfter: null, disabled: null });
      return { ok: true, tried: true, why: "자동 로그인 성공" };
    }

    const text = await bodyText(page);
    const stillSignIn = (await pw.count().catch(() => 0)) > 0 && page.url().includes("/account/sign-in");
    if (/보안문자|자동입력 방지|captcha|로봇이 아닙니다/i.test(text)) {
      record("보안문자", { retryAfter: new Date(Date.now() + BACKOFF_CAPTCHA_MS).toISOString(), page: text.slice(0, 200) });
      return { ok: false, tried: true, why: "토스가 보안문자를 요구 — 직접 로그인 필요(24시간 자동 시도 쉼)" };
    }
    // 로그인 화면에 그대로 있으면 기본은 '거절'로 본다. 추가 인증 안내로 확실히 보일 때만 기다린다.
    // ('비밀번호를 확인해주세요' 류를 인증 대기로 오인해 6시간마다 틀린 비밀번호를 넣으면 계정이 잠긴다)
    const looksVerify =
      /토스 ?앱|인증|알림을 보냈|확인 요청/.test(text) && !/비밀번호|일치하지|올바르지|잘못|존재하지|잠금|잠겼/.test(text);
    if (stillSignIn && !looksVerify) {
      // 비밀번호 틀림·계정 문제로 보인다. 다시 시도하면 계정이 잠길 수 있어 멈춘다.
      record("로그인 거절", { disabled: `로그인 화면에서 넘어가지 않음 — 비밀번호를 바꿨다면 다시 저장: ${text.slice(0, 120)}`, page: text.slice(0, 200) });
      return { ok: false, tried: true, why: "저장된 계정으로 로그인 거절(비밀번호 변경?) — 자동 로그인 중지, toss-cred.mjs 로 다시 저장" };
    }

    // 토스 앱 확인·문자 인증 등 — 운영자가 휴대폰에서 눌러 주면 이어서 끝난다
    try {
      onVerify?.(text.slice(0, 120));
    } catch {}
    if (await waitDashboard(page, VERIFY_WAIT_MS)) {
      record("성공(추가 인증 후)", { retryAfter: null, disabled: null });
      return { ok: true, tried: true, why: "추가 인증 후 로그인 성공" };
    }
    record("추가 인증 대기 초과", { retryAfter: new Date(Date.now() + BACKOFF_VERIFY_MS).toISOString(), page: text.slice(0, 200) });
    return { ok: false, tried: true, why: `추가 인증이 필요해 멈춤(6시간 뒤 재시도): ${text.slice(0, 80)}` };
  } catch (e) {
    record("오류", { retryAfter: new Date(Date.now() + BACKOFF_VERIFY_MS).toISOString(), error: String(e?.message || e).slice(0, 200) });
    return { ok: false, tried: true, why: `자동 로그인 중 오류: ${String(e?.message || e).slice(0, 100)}` };
  }
}
