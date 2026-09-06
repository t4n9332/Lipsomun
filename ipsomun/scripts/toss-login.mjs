/**
 * 토스쇼핑 로그인용 브라우저 열기 (최초 1회 + 세션 만료 시 재로그인)
 * - 브라우저 프로필(scripts/.toss-profile/)에 로그인 상태가 저장되어
 *   이후 toss-playwright.mjs 실행 시 로그인이 생략됩니다.
 * - 사용법: node scripts/toss-login.mjs
 *   → 열린 창에서 토스쇼핑 로그인 (쉐어링크 미가입이면 sharelink.toss.im에서 가입)
 *   → 로그인 확인 후 브라우저 창을 닫으면 종료됩니다.
 * - 창을 닫으면 세션을 헤드리스로 확인하고, 살아 있으면 곧바로 보충 회차
 *   (toss-playwright.mjs --match-only)를 1회 돌립니다. 재로그인 후 다음 정기 회차까지
 *   최대 2시간 놀던 시간을 없애기 위함 — 출력은 터미널과 toss-auto.log 양쪽에 남습니다.
 *   보충 회차를 원하지 않으면:  node scripts/toss-login.mjs --no-run
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { existsSync, unlinkSync, appendFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, ".toss-profile");
const LOGIN_ALERT_MARKER = path.join(__dirname, ".toss-login-alert-sent");
const LOG_PATH = path.join(__dirname, "toss-auto.log");
const NO_RUN = process.argv.includes("--no-run");

const { chromium } = await import("playwright").catch(() => {
  console.error(
    "\nPlaywright가 설치되어 있지 않습니다:\n  npm i -D playwright && npx playwright install chromium\n"
  );
  process.exit(1);
});

console.log("\n브라우저를 엽니다 — 로그인은 sharelink.toss.im 에서 합니다.");
console.log("  ※ toss.shopping 사이트에는 로그인 버튼이 없습니다 (공식 구조)");
console.log("  1) 첫 번째 탭(sharelink.toss.im)에서 로그인/가입");
console.log("  2) 두 번째 탭(토스쇼핑 상품 페이지)을 새로고침해 공유 아이콘이 보이는지 확인");
console.log("  3) 확인되면 브라우저 창을 닫으면 저장 완료 → 보충 회차가 자동으로 1회 돕니다\n");

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  args: ["--lang=ko-KR"],
});

const page = context.pages()[0] || (await context.newPage());
await page.goto("https://sharelink.toss.im/", { waitUntil: "domcontentloaded" });
// 로그인 확인용: 토스쇼핑 상품 페이지 탭 (로그인 후 새로고침하면 공유 아이콘·가격이 보여야 함)
const checkPage = await context.newPage();
await checkPage
  .goto("https://toss.shopping/t/130651143", { waitUntil: "domcontentloaded" })
  .catch(() => {});
await page.bringToFront().catch(() => {});

await new Promise((resolve) => context.on("close", resolve));
console.log("✔ 로그인 세션이 저장되었습니다 (scripts/.toss-profile).");

// 세션이 실제로 살아 있는지 헤드리스로 확인 (창을 그냥 닫은 경우를 걸러낸다)
const alive = await checkSession();
if (!alive) {
  console.log("✘ 쉐어링크 어드민에 로그인되어 있지 않습니다. 다시 실행해 로그인해주세요.");
  process.exit(1);
}
console.log("✔ 세션 확인 완료.");
try {
  if (existsSync(LOGIN_ALERT_MARKER)) unlinkSync(LOGIN_ALERT_MARKER); // 다음 만료 때 알림이 다시 가게
} catch {}

if (NO_RUN) {
  console.log("보충 회차는 건너뜁니다 (--no-run). 매칭 도구:  node scripts/toss-playwright.mjs --match-only");
  process.exit(0);
}

console.log("\n▶ 보충 회차를 시작합니다 (toss-playwright.mjs --match-only) — 3~6분 걸립니다.\n");
const code = await runCatchUp();
console.log(code === 0 ? "\n✔ 보충 회차 완료." : `\n✘ 보충 회차가 실패했습니다 (exit ${code}). toss-auto.log를 확인하세요.`);
process.exit(code);

async function checkSession() {
  try {
    const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      viewport: { width: 1280, height: 900 },
      args: ["--lang=ko-KR"],
    });
    try {
      const p = ctx.pages()[0] || (await ctx.newPage());
      await p.goto("https://sharelink.toss.im/home", { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(4000);
      return await p.evaluate(() => document.body.innerText.includes("실적 대시보드"));
    } finally {
      await Promise.race([ctx.close().catch(() => {}), new Promise((r) => setTimeout(r, 15000))]);
    }
  } catch {
    return false;
  }
}

/** 보충 회차 실행 — 출력을 터미널과 toss-auto.log에 동시에 남긴다 */
function runCatchUp() {
  return new Promise((resolve) => {
    const stamp = `\n===== 재로그인 보충 회차 ${new Date().toLocaleString("ko-KR")} =====\n`;
    try {
      appendFileSync(LOG_PATH, stamp);
    } catch {}
    const child = spawn(process.execPath, [path.join(__dirname, "toss-playwright.mjs"), "--match-only"], {
      cwd: path.join(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const tee = (chunk) => {
      process.stdout.write(chunk);
      try {
        appendFileSync(LOG_PATH, chunk);
      } catch {}
    };
    child.stdout.on("data", tee);
    child.stderr.on("data", tee);
    child.on("close", (c) => resolve(c ?? 1));
    child.on("error", () => resolve(1));
  });
}
