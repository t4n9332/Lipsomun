/**
 * 스레드 자동 게시 연결 (운영자가 한 번 실행)
 *
 *   node scripts/threads-setup.mjs          # 앱 정보 입력(처음만) → 스레드 승인 → 토큰 암호화 저장
 *   node scripts/threads-setup.mjs --app    # 앱 ID·시크릿을 다시 입력
 *
 * 준비(Meta 개발자 앱, 한 번만): developers.facebook.com → 앱 만들기 → 'Threads API 액세스' 사용 사례 →
 *   권한 threads_basic · threads_content_publish · threads_manage_replies 추가 →
 *   Threads 설정의 '리디렉션 콜백 URL'에  https://lipsomun.co.kr/threads-callback  등록 →
 *   역할 → 'Threads 테스터'에 올릴 스레드 계정 추가 후, 그 계정의 스레드 앱 설정에서 초대 수락.
 * 비밀값(앱 시크릿·토큰)은 DPAPI 로 암호화해 scripts/.threads-config.json 에 둔다(gitignore).
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { authUrl, exchangeCode, whoami } from "./lib-threads.mjs";
import { saveApp, loadApp, saveToken } from "./lib-threads-config.mjs";
import { askHidden } from "./lib-prompt.mjs";

const REDIRECT_URI = "https://lipsomun.co.kr/threads-callback";
const args = process.argv.slice(2);

let app = args.includes("--app") ? null : loadApp();
if (!app) {
  console.log("\nMeta 개발자 앱 정보를 입력합니다 (앱 대시보드 → 앱 설정 → 기본 설정, Threads 앱 ID·시크릿).");
  console.log(`리디렉션 콜백 URL 에는 ${REDIRECT_URI} 가 등록돼 있어야 합니다.\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const appId = (await rl.question("Threads 앱 ID: ")).trim();
  rl.close();
  const appSecret = await askHidden("Threads 앱 시크릿(* 로 표시): ");
  // 2026-11-24 실제 사고: 앱 ID 칸에 이메일, 시크릿 칸에 계정 비밀번호를 넣었다 → 형식을 검사해 아예 저장하지 않는다
  if (!/^\d{10,20}$/.test(appId)) {
    console.log("✘ Threads 앱 ID 는 숫자만 10~20자리입니다(이메일·이름이 아님). 저장하지 않았습니다.");
    console.log("  위치: 앱 대시보드 → 사용 사례 → Threads API 액세스 '맞춤 설정' → 설정 → 'Threads 앱 ID'");
    process.exit(1);
  }
  if (!/^[0-9a-f]{32}$/i.test(appSecret)) {
    console.log("✘ Threads 앱 시크릿은 영문·숫자 32자리입니다. 페이스북·스레드 비밀번호가 아닙니다. 저장하지 않았습니다.");
    console.log("  위치: 같은 설정 화면의 'Threads 앱 시크릿' 옆 '표시' → 복사");
    process.exit(1);
  }
  saveApp(appId, appSecret);
  app = { appId, appSecret };
  console.log("✔ 앱 정보를 암호화해 저장했습니다.\n");
}

const url = authUrl({ appId: app.appId, redirectUri: REDIRECT_URI, state: "ipsomun" });
console.log("▶ 브라우저에서 스레드 승인 화면을 엽니다. 입소문 홍보에 쓸 계정으로 로그인해 '허용'을 누르세요.");
console.log(`  (안 열리면 이 주소를 복사해 여세요)\n  ${url}\n`);
try {
  spawn("explorer.exe", [url], { detached: true, stdio: "ignore" }).unref();
} catch {}

console.log("승인하면 lipsomun.co.kr/threads-callback 페이지에 코드가 크게 표시됩니다.");
const rl2 = createInterface({ input: process.stdin, output: process.stdout });
const pasted = (await rl2.question("그 코드(또는 주소창 전체)를 붙여 넣으세요: ")).trim();
rl2.close();
let code = pasted;
try {
  code = new URL(pasted).searchParams.get("code") || pasted;
} catch {}
code = code.replace(/#_$/, "").trim();
if (!code) {
  console.log("✘ 코드가 비어 있습니다.");
  process.exit(1);
}

try {
  const t = await exchangeCode({ appId: app.appId, appSecret: app.appSecret, redirectUri: REDIRECT_URI, code });
  saveToken(t);
  const me = await whoami(t.accessToken);
  console.log(`\n✔ 연결 완료: @${me.username} (토큰 만료 ${t.expiresAt.slice(0, 10)}, 게시 스크립트가 만료 전에 자동 갱신)`);
  console.log("  다음 자동 회차(09:30)부터 하루 1개씩 올라갑니다. 미리 보기:  node scripts/threads-post.mjs --dry");
} catch (e) {
  console.log(`\n✘ 토큰 발급 실패: ${e.message}`);
  console.log("  코드는 한 번만, 몇 분 안에만 쓸 수 있습니다. 다시 실행해 새로 승인하세요.");
  process.exit(1);
}
