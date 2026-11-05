#!/usr/bin/env node
/**
 * GS25 한 달치 수집을 명령 하나로: 탭 전환 → 각 탭 스크롤·덤프 → 정규화·수집 → (선택) 커밋·푸시.
 * 통신을 가로채지 않는다. 화면을 읽고(adb uiautomator), 화면을 넘기고(swipe), 탭 글자를 눌러(tap) 전환할 뿐이다.
 *
 * 【운영자 PC에서, 매달 자동】
 *   1) 우리동네GS 앱을 '행사' 목록 화면(탭들이 보이는 상태)까지 열어 둔다. (로그인·첫 진입은 사람이 한 번)
 *   2) node scripts/gs25/monthly.mjs
 *      → 1+1·2+1·덤 탭을 차례로 눌러 각각 끝까지 스크롤하며 덤프 → data/gs25/<월>/ 에 수집 결과 저장.
 *
 * 매달 자동 실행(스케줄)은 이 스크립트를 걸어 두면 된다 — 맨 아래 '스케줄' 참고.
 *
 * 옵션
 *   --month=YYYY-MM   대상 월(기본: 한국시간 이번 달)
 *   --tabs=1+1,2+1,덤 수집할 탭(기본 이 셋). 탭 글자가 화면에 보여야 눌린다.
 *   --dumps=DIR       덤프 저장 폴더(기본 scratch: ./gs25-dumps/<월>)
 *   --ui-config=FILE  자원ID 설정(scripts/gs25/ui-config.json). 있으면 정밀 추출.
 *   --commit          수집 뒤 data/gs25 변경을 git 커밋·푸시(브랜치는 현재 브랜치)
 *   --bridge          /cvs 화면(data/cvs/current.json)의 GS25 칸도 갱신
 *   --device=SERIAL   기기 여럿일 때
 *   --dry             adb 없이 실행 계획만 출력(설정 점검용)
 *
 * 앱 자동 실행(am start)은 기기·앱 버전마다 화면 진입 경로가 달라 하지 않는다 — 사람이 행사 화면을 띄워 둔다.
 * 탭 위치는 화면 덤프에서 탭 글자를 찾아 누르므로 좌표를 적어 둘 필요가 없다.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { findTab, parseUiNodes, kstMonth } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(HERE, "..");
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const has = (k) => args.includes(`--${k}`);
const DRY = has("dry");

const month = flag("month", kstMonth());
const tabs = flag("tabs", "1+1,2+1,덤").split(",").map((s) => s.trim()).filter(Boolean);
const dumpsDir = path.resolve((flag("dumps", `./gs25-dumps/${month}`)).replace(/^~/, os.homedir()));
const uiConfig = flag("ui-config", fs.existsSync(path.join(HERE, "ui-config.json")) ? path.join(HERE, "ui-config.json") : "");
const device = flag("device");
const maxScrolls = Number(flag("max", "60"));
const pause = Number(flag("pause", "900"));

const adb = (...a) => execFileSync("adb", device ? ["-s", device, ...a] : a, { encoding: "utf8", maxBuffer: 64 << 20 });
const sleep = (ms) => { const end = Date.now() + ms; while (Date.now() < end) { try { execFileSync("sleep", ["0.05"]); } catch { break; } } };
const dumpXml = () => { adb("shell", "uiautomator", "dump", "/sdcard/.gs25dump.xml"); return adb("shell", "cat", "/sdcard/.gs25dump.xml"); };

console.log(`GS25 월간 수집 · ${month} · 탭 [${tabs.join(", ")}] · 덤프→ ${dumpsDir}${uiConfig ? ` · 설정 ${path.basename(uiConfig)}` : " · (좌표 모드)"}${DRY ? " · DRY" : ""}`);

if (DRY) {
  console.log("DRY: adb 호출 없음. 실제 실행 시 순서:");
  tabs.forEach((t, i) => console.log(`  ${i + 1}. 탭 "${t}" 찾아 누름 → 끝까지 스크롤하며 덤프(${t}-NNN.xml)`));
  console.log(`  → node gs25-collect.mjs --source=ui --in=${dumpsDir} --month=${month}${uiConfig ? ` --ui-config=${uiConfig}` : ""}${has("bridge") ? " --bridge" : ""}`);
  if (has("commit")) console.log("  → git add data/gs25 && commit && push");
  process.exit(0);
}

try { adb("get-state"); } catch { console.error("adb 기기 없음. 에뮬레이터를 켜거나 USB 디버깅을 허용하세요(adb devices)."); process.exit(1); }
fs.mkdirSync(dumpsDir, { recursive: true });

const size = adb("shell", "wm", "size").match(/(\d+)x(\d+)/);
const [W, H] = size ? [Number(size[1]), Number(size[2])] : [1080, 2340];
const sx = Math.floor(W / 2), sy1 = Math.floor(H * 0.75), sy2 = Math.floor(H * 0.30);

for (const tab of tabs) {
  // 탭 글자를 찾아 누른다(좌표 하드코딩 없이). 탭이 안 보이면 건너뛴다.
  const nodes = parseUiNodes(dumpXml(), false);
  const hint = uiConfig && JSON.parse(fs.readFileSync(uiConfig, "utf8")).tabResIdHint;
  const pos = findTab(nodes, tab, hint ?? "tab");
  if (!pos) { console.warn(`  탭 "${tab}" 를 화면에서 못 찾음 — 건너뜀(이 탭 글자가 보이는 상태인지 확인).`); continue; }
  adb("shell", "input", "tap", `${pos.cx}`, `${pos.cy}`); sleep(1200);
  // 스크롤·덤프: 화면 글자가 2번 연속 같으면 바닥
  const prefix = tab.replace(/[^\w+가-힣]/g, "");
  let last = "", stable = 0, n = 0;
  process.stdout.write(`  탭 "${tab}" 수집`);
  for (let i = 0; i < maxScrolls; i++) {
    const xml = dumpXml();
    fs.writeFileSync(path.join(dumpsDir, `${prefix}-${String(n++).padStart(3, "0")}.xml`), xml);
    const texts = (xml.match(/text="[^"]+"/g) || []).join("");
    process.stdout.write(".");
    if (texts === last) { if (++stable >= 2) break; } else stable = 0;
    last = texts;
    adb("shell", "input", "swipe", `${sx}`, `${sy1}`, `${sx}`, `${sy2}`, "500"); sleep(pause);
  }
  console.log(` ${n}장`);
}
try { adb("shell", "rm", "-f", "/sdcard/.gs25dump.xml"); } catch { /* */ }

// 수집(정규화·중복·비교·완료판정·저장)
const collectArgs = ["--source=ui", `--in=${dumpsDir}`, `--month=${month}`, ...(uiConfig ? [`--ui-config=${uiConfig}`] : []), ...(has("bridge") ? ["--bridge"] : [])];
console.log(`\n수집: node gs25-collect.mjs ${collectArgs.join(" ")}`);
let collectCode = 0;
try { console.log(execFileSync(process.execPath, [path.join(SCRIPTS, "gs25-collect.mjs"), ...collectArgs], { encoding: "utf8" })); }
catch (e) { collectCode = e.status || 1; process.stdout.write(e.stdout || ""); process.stderr.write(e.stderr || ""); }

// 커밋·푸시(선택)
if (has("commit")) {
  const ROOT = path.join(SCRIPTS, "..");
  try {
    const changed = execFileSync("git", ["-C", ROOT, "status", "--porcelain", "data/gs25", "data/cvs"], { encoding: "utf8" }).trim();
    if (!changed) console.log("커밋할 변경 없음.");
    else {
      execFileSync("git", ["-C", ROOT, "add", "data/gs25", "data/cvs"], { stdio: "inherit" });
      execFileSync("git", ["-C", ROOT, "commit", "-m", `GS25 ${month} 행사 수집(앱 화면 ui)`], { stdio: "inherit" });
      execFileSync("git", ["-C", ROOT, "push"], { stdio: "inherit" });
      console.log("커밋·푸시 완료.");
    }
  } catch (e) { console.error("git 단계 실패:", e.message); }
}

console.log(`\n끝. 결과: data/gs25/${month}/ (promotions.json·csv, run.json 의 '상태'로 완료 여부 확인)`);
process.exit(collectCode);

/* ──────────── 매달 자동 실행(스케줄) ────────────
 * macOS·리눅스(crontab -e): 매월 1일 10:00 에(앱이 열려 기기가 연결돼 있어야 함)
 *   0 10 1 * * cd /경로/ipsomun && /usr/local/bin/node scripts/gs25/monthly.mjs --commit >> ~/gs25.log 2>&1
 * 윈도우(작업 스케줄러): 매월 1일, 프로그램 node, 인수 "scripts\gs25\monthly.mjs --commit", 시작 위치 ipsomun 폴더.
 * 주의: 이 작업은 폰/에뮬레이터가 켜져 행사 화면이 떠 있어야 동작한다. 서버(GitHub Actions)에는 기기가 없어 못 돌린다.
 */
