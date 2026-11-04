#!/usr/bin/env node
/**
 * 우리동네GS 앱 '행사' 화면을 자동으로 조금씩 넘기며(스크롤), 매번 화면에 보이는 글자만 저장한다.
 * 통신을 가로채지 않고, adb(안드로이드 디버그 다리) 의 uiautomator 덤프(접근성 트리)만 받는다.
 *
 * 【운영자 PC에서】Android Studio 에뮬레이터 또는 USB 디버깅 켠 실제 폰에 앱을 깔고 로그인한 뒤,
 * 행사 목록 화면(1+1 탭 등)을 띄워 놓고 실행:
 *
 *   node scripts/gs25/adb-dump.mjs --tab=1+1              # 현재 탭을 끝까지 넘기며 덤프 저장
 *   node scripts/gs25/adb-dump.mjs --tab=2+1 --out=~/gs25-dumps
 *   node scripts/gs25/adb-dump.mjs --tab=덤
 *
 * 탭 전환은 화면마다 위치가 달라 자동화하지 않는다 — 탭을 손으로 누르고, 탭마다 한 번씩 돌린다.
 * 저장 위치(기본 ./gs25-dumps/<탭>-NNN.xml)에 XML 들이 쌓인다. 그 폴더를 그대로(또는 민감정보를 지운 뒤)
 * 작업자에게 주면 다음으로 수집한다:
 *
 *   node scripts/gs25-collect.mjs --source=ui --in=gs25-dumps --month=2026-11
 *
 * 【개인정보】덤프에는 화면 글자만 들어간다. 상단 '내 정보'(이름·포인트·바코드)가 보이면 그 영역을
 * 가린 채로 스크롤하거나, 저장된 XML 에서 그 text 를 지우고 전달할 것. 수집기도 포인트·전화번호 꼴은
 * 자동으로 거르지만, 확실히 하려면 화면에 안 띄우는 게 가장 좋다.
 *
 * 이 스크립트는 로그인·결제·탭 전환을 하지 않는다. 읽기(덤프)와 세로 스크롤만 한다.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const tab = flag("tab", "");
const maxScrolls = Number(flag("max", "60"));
const pause = Number(flag("pause", "900"));
const outDir = path.resolve((flag("out", "./gs25-dumps")).replace(/^~/, os.homedir()));
const device = flag("device"); // 여러 기기면 --device=<serial>
const adb = (...a) => execFileSync("adb", device ? ["-s", device, ...a] : a, { encoding: "utf8", maxBuffer: 64 << 20 });

try { adb("get-state"); } catch { console.error("adb 기기를 못 찾음. 에뮬레이터를 켜거나 USB 디버깅을 허용하세요 (adb devices 로 확인)."); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

// 화면 크기 → 가운데를 아래에서 위로 쓸어 스크롤(한 화면의 70%만 — 상품이 겹쳐 나와 누락 방지)
const size = adb("shell", "wm", "size");
const sm = size.match(/(\d+)x(\d+)/);
const [W, H] = sm ? [Number(sm[1]), Number(sm[2])] : [1080, 2340];
const x = Math.floor(W / 2), y1 = Math.floor(H * 0.75), y2 = Math.floor(H * 0.30);

const dump = () => {
  // 기기 안에 뽑은 뒤 stdout 으로 바로 읽는다(기기에 파일 안 남김)
  adb("shell", "uiautomator", "dump", "/sdcard/.gs25dump.xml");
  return adb("shell", "cat", "/sdcard/.gs25dump.xml");
};

const prefix = tab ? tab.replace(/[^\w+가-힣]/g, "") : "screen";
let last = "", stable = 0, n = 0;
console.log(`화면 ${W}x${H} · 탭 "${tab || "(미지정)"}" · 최대 ${maxScrolls}회 스크롤 → ${outDir}`);
for (let i = 0; i < maxScrolls; i++) {
  let xml;
  try { xml = dump(); } catch (e) { console.error("덤프 실패:", e.message); break; }
  const file = path.join(outDir, `${prefix}-${String(n++).padStart(3, "0")}.xml`);
  fs.writeFileSync(file, xml);
  const texts = (xml.match(/text="[^"]+"/g) || []).join("");
  process.stdout.write(`\r  ${i + 1}/${maxScrolls} 저장 ${path.basename(file)} (글자노드 ${(xml.match(/text="[^"]+"/g) || []).length})   `);
  // 화면 글자가 2번 연속 안 바뀌면 끝(더 내릴 게 없음)
  if (texts === last) { if (++stable >= 2) { console.log("\n바닥 도달 — 종료."); break; } }
  else stable = 0;
  last = texts;
  adb("shell", "input", "swipe", `${x}`, `${y1}`, `${x}`, `${y2}`, "500");
  execSyncSleep(pause);
}
try { adb("shell", "rm", "-f", "/sdcard/.gs25dump.xml"); } catch { /* */ }
console.log(`\n완료: ${n}장 저장. 다음: node scripts/gs25-collect.mjs --source=ui --in=${path.relative(process.cwd(), outDir) || outDir} --month=YYYY-MM`);

function execSyncSleep(ms) { const end = Date.now() + ms; while (Date.now() < end) { try { execFileSync("sleep", ["0.05"]); } catch { break; } } }
