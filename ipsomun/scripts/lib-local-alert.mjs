/**
 * 로컬 PC 알림 — 텔레그램 운영 경고가 못 나갈 때(TELEGRAM_ADMIN_CHAT_ID 미설정·사이트 장애)의 대체 경로.
 *
 * 2026-11-19~24: 토스 세션이 끊겼는데 /api/admin/alert 가 502(관리자 대화 ID 미설정)로 거절했고,
 * 스크립트가 그 실패를 삼켜서 6일간 아무도 몰랐다. 그래서 텔레그램과 별개로
 *   1) 바탕화면에 '더블클릭하면 바로 재로그인' 배치 파일을 놓고 (복구되면 자동 삭제)
 *   2) Windows 알림(토스트)을 한 번 띄운다.
 * 둘 다 실패해도 원래 오류를 가리지 않도록 예외를 던지지 않는다.
 */

import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");

/** 바탕화면 재로그인 바로가기 — 이름이 곧 안내문이다 */
export const RELOGIN_SHORTCUT = path.join(os.homedir(), "Desktop", "토스 다시 로그인 (더블클릭).bat");

/**
 * 바탕화면에 재로그인 배치 파일을 만든다.
 * - UTF-8 + `chcp 65001` 로 한글 경로를 읽는다(2026-11-24 cmd 에서 확인).
 * - 로그인 성공 뒤 보충 회차가 이 파일을 지우므로, 실행 줄 전체를 한 줄로 둬서
 *   cmd 가 다음 줄을 읽으려다 '배치 파일을 찾을 수 없습니다'를 내지 않게 한다.
 */
export function writeReloginShortcut(reason = "") {
  try {
    if (!existsSync(path.dirname(RELOGIN_SHORTCUT))) return false;
    const why = String(reason).split("\n")[0].replace(/[&|<>^%"]/g, " ").slice(0, 100);
    const body = [
      "@echo off",
      "chcp 65001 >nul",
      "echo 입소문: 토스 쉐어링크 세션이 끊겼습니다.",
      why ? `echo 원인: ${why}` : "",
      "echo 열리는 창에서 로그인한 뒤 창을 닫으면 끝입니다. (이 파일은 복구되면 저절로 지워집니다)",
      "echo.",
      `cd /d "${PROJECT_DIR}" && node scripts\\toss-login.mjs & echo. & pause`,
      "",
    ]
      .filter((l, i, a) => l !== "" || i === a.length - 1)
      .join("\r\n");
    writeFileSync(RELOGIN_SHORTCUT, body, "utf8");
    return true;
  } catch {
    return false;
  }
}

/** 세션이 정상으로 돌아오면 바탕화면 파일을 치운다 */
export function removeReloginShortcut() {
  try {
    if (existsSync(RELOGIN_SHORTCUT)) unlinkSync(RELOGIN_SHORTCUT);
  } catch {}
}

/**
 * Windows 토스트 알림 (Windows PowerShell 5.1 WinRT API). 한글이 깨지지 않게 -EncodedCommand 로 넘긴다.
 * 작업 스케줄러가 '사용자 로그온 시에만'(Interactive)으로 돌기 때문에 화면에 뜬다.
 */
export function showToast(title, message) {
  if (process.platform !== "win32") return false;
  const q = (s) => "'" + String(s).replace(/'/g, "''").slice(0, 200) + "'";
  const ps = [
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
    "$x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
    "$t = $x.GetElementsByTagName('text')",
    `$t.Item(0).AppendChild($x.CreateTextNode(${q(title)})) > $null`,
    `$t.Item(1).AppendChild($x.CreateTextNode(${q(message)})) > $null`,
    "$n = [Windows.UI.Notifications.ToastNotification]::new($x)",
    "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show($n)",
  ].join("; ");
  try {
    const r = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(ps, "utf16le").toString("base64")],
      { timeout: 15000, windowsHide: true }
    );
    return r.status === 0;
  } catch {
    return false;
  }
}
