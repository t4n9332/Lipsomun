/**
 * 토스쇼핑 최초 1회 로그인용 브라우저 열기
 * - 브라우저 프로필(scripts/.toss-profile/)에 로그인 상태가 저장되어
 *   이후 toss-playwright.mjs 실행 시 로그인이 생략됩니다.
 * - 사용법: node scripts/toss-login.mjs
 *   → 열린 창에서 토스쇼핑 로그인 (쉐어링크 미가입이면 sharelink.toss.im에서 가입)
 *   → 로그인 확인 후 브라우저 창을 닫으면 종료됩니다.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, ".toss-profile");

const { chromium } = await import("playwright").catch(() => {
  console.error(
    "\nPlaywright가 설치되어 있지 않습니다:\n  npm i -D playwright && npx playwright install chromium\n"
  );
  process.exit(1);
});

console.log("\n브라우저를 엽니다 — 토스쇼핑에 로그인하세요.");
console.log("  1) toss.shopping 우측 상단(또는 상품 페이지)에서 로그인");
console.log("  2) 쉐어링크 미가입이면 sharelink.toss.im 에서 가입");
console.log("  3) 로그인 확인 후 브라우저 창을 닫으면 저장 완료\n");

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  args: ["--lang=ko-KR"],
});

const page = context.pages()[0] || (await context.newPage());
await page.goto("https://toss.shopping/", { waitUntil: "domcontentloaded" });

await new Promise((resolve) => context.on("close", resolve));
console.log("✔ 로그인 세션이 저장되었습니다 (scripts/.toss-profile).");
console.log("이제 매칭 도구를 실행하세요:  node scripts/toss-playwright.mjs");
process.exit(0);
