/**
 * 토스 쉐어링크 자동 로그인 정보 등록·시험 (운영자가 직접 실행)
 *
 *   node scripts/toss-cred.mjs          # ID·비밀번호 입력 → 암호화 저장 → 바로 시험 로그인
 *   node scripts/toss-cred.mjs --test   # 저장된 정보로 시험 로그인만
 *   node scripts/toss-cred.mjs --clear  # 저장 정보 삭제(자동 로그인 끄기)
 *
 * 비밀번호는 화면에 * 로만 보이고, Windows DPAPI 로 암호화해 scripts/.toss-cred.json 에 둔다
 * (이 PC 의 이 Windows 계정에서만 풀림, .gitignore 처리). 자세한 규칙은 lib-toss-cred.mjs 맨 위.
 * 시험 로그인은 정기 회차와 같은 헤드리스 방식이다. 토스 앱 확인 요청이 오면 휴대폰에서 눌러 주면 된다.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { saveCred, hasCred, tryAutoLogin, CRED_PATH, AUTOLOGIN_STATE_PATH } from "./lib-toss-cred.mjs";
import { removeReloginShortcut } from "./lib-local-alert.mjs";
import { askHidden } from "./lib-prompt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, ".toss-profile");
const LOGIN_ALERT_MARKER = path.join(__dirname, ".toss-login-alert-sent");
const args = process.argv.slice(2);

if (args.includes("--clear")) {
  for (const p of [CRED_PATH, AUTOLOGIN_STATE_PATH]) if (existsSync(p)) unlinkSync(p);
  console.log("✔ 자동 로그인 정보를 지웠습니다. 앞으로 세션이 끊기면 바탕화면 파일로 직접 로그인합니다.");
  process.exit(0);
}

if (!args.includes("--test")) {
  console.log("\n토스 쉐어링크(business.toss.im) 계정을 저장합니다. 비밀번호는 이 PC 에서만 풀리게 암호화됩니다.\n");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const id = (await rl.question("이메일/ID: ")).trim();
  rl.close();
  const password = await askHidden("비밀번호(입력 내용은 * 로 표시): ");
  if (!id || !password) {
    console.log("✘ ID 또는 비밀번호가 비어 있어 저장하지 않았습니다.");
    process.exit(1);
  }
  saveCred(id, password);
  console.log("✔ 암호화해서 저장했습니다 (scripts/.toss-cred.json).\n");
} else if (!hasCred()) {
  console.log("✘ 저장된 정보가 없습니다. 먼저:  node scripts/toss-cred.mjs");
  process.exit(1);
}

console.log("▶ 시험 로그인 중… (정기 회차와 같은 방식, 최대 3~4분)");
console.log("  토스 앱에 로그인 확인 요청이 오면 휴대폰에서 확인을 눌러 주세요.\n");
const { chromium } = await import("playwright");
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: ["--lang=ko-KR"],
});
let result;
try {
  const page = ctx.pages()[0] || (await ctx.newPage());
  result = await tryAutoLogin(page, {
    force: true,
    onVerify: (t) => console.log(`  … 추가 인증 화면: ${t}\n  휴대폰에서 확인해 주세요 (3분 기다립니다).`),
  });
} finally {
  await Promise.race([ctx.close().catch(() => {}), new Promise((r) => setTimeout(r, 15000))]);
}

if (!result.ok) {
  console.log(`✘ ${result.why}`);
  console.log("  (회차는 계속 바탕화면 '토스 다시 로그인 (더블클릭)' 방식으로 알려 드립니다)");
  process.exit(1);
}
console.log(`✔ ${result.why} — 이제 세션이 끊겨도 회차가 스스로 다시 로그인합니다.`);
try {
  if (existsSync(LOGIN_ALERT_MARKER)) unlinkSync(LOGIN_ALERT_MARKER);
} catch {}
removeReloginShortcut();

console.log("\n▶ 밀린 매칭 회차를 1회 돌립니다 (3~6분, 창을 닫아도 다음 정기 회차가 이어 갑니다).\n");
const child = spawn(process.execPath, [path.join(__dirname, "toss-playwright.mjs"), "--match-only"], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
});
child.on("close", (code) => process.exit(code ?? 0));
