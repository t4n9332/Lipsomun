#!/usr/bin/env node
/**
 * 편의점 패치노트 쇼츠 자동 제작 — /cvs/shorts 를 녹화해 영상 + 자막 + 설명문을 만든다.
 *
 *   node scripts/cvs-shorts.mjs                         # 운영 사이트를 녹화
 *   node scripts/cvs-shorts.mjs http://localhost:3000   # 로컬 개발 서버를 녹화
 *   node scripts/cvs-shorts.mjs --bgm 음악.mp3          # 배경음악까지 입혀 바로 올릴 mp4 생성
 *     (ffmpeg 필요: 윈도우는 `winget install ffmpeg`. 다른 위치면 환경변수 FFMPEG=경로)
 *
 * 결과 (scripts/out/shorts-YYYY-MM/)
 *   - video.webm      1080×1920 무음 영상 (앞쪽 로딩 구간은 잘라냄)
 *   - final.mp4       --bgm 을 주면: 배경음악을 깔고 끝에서 페이드아웃한 업로드용 영상
 *   - captions.srt    장마다 한 줄 자막 (유튜브 자막 업로드 또는 편집기 자막 트랙)
 *   - description.txt 제목 후보·설명·해시태그
 *   - thumb.png       썸네일 후보 (첫 버프 장면)
 *
 * BGM 은 라이선스 프리 음원만 쓸 것 — 출처·라이선스 문구를 description.txt 끝에 붙여두면
 * Content ID 오탐 이의제기 때 바로 쓸 수 있다 (--bgm-credit "곡명 - 작곡가 (라이선스)").
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const BGM = opt("--bgm");
const BGM_CREDIT = opt("--bgm-credit");
const BASE = (argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--")) || "https://lipsomun.co.kr").replace(/\/$/, "");
if (BGM && !fs.existsSync(BGM)) {
  console.error(`배경음악 파일이 없습니다: ${BGM}`);
  process.exit(1);
}
const SLIDE_MS = 3500; // components/CvsShorts.tsx 의 SLIDE_MS 와 같아야 자막이 맞는다

const srtTime = (ms) => {
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s},${String(ms % 1000).padStart(3, "0")}`;
};
const won = (n) => (n == null ? "" : n.toLocaleString("ko-KR") + "원");

function caption(s) {
  switch (s.kind) {
    case "intro": return `${s.title} 시작합니다`;
    case "outro": return `전체 목록은 ${s.sub} 에서`;
    case "buff":
    case "nerf": {
      const head = s.kind === "buff" ? "버프!" : "너프…";
      const what = s.from !== s.to ? `${s.from}에서 ${s.to}로` : `${s.to} 그대로, 정가 ${won(s.fromPrice)}에서 ${won(s.toPrice)}로`;
      return `${head} ${s.brand} ${s.name} ${what}. 1개당 ${won(s.toUnit)}`;
    }
    case "best": return `${s.cat} 꿀템! ${s.brand} ${s.name} ${s.t}, 1개당 ${won(s.unit)}으로 ${won(s.saved)} 아껴요`;
    case "versus": return `${s.name}, 제일 싼 곳은 ${s.offers[0].brand} ${s.offers[0].t}`;
    default: return "";
  }
}

// PW_CHROMIUM: 설치된 Playwright 와 브라우저 버전이 다를 때 크롬 실행 파일 경로를 직접 지정
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const tmp = path.join(__dirname, "out", ".rec");
fs.rmSync(tmp, { recursive: true, force: true });
const ctx = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  recordVideo: { dir: tmp, size: { width: 1080, height: 1920 } },
});
const page = await ctx.newPage();
const recStart = Date.now(); // 녹화는 페이지가 열리는 순간부터 — 슬라이드 시작 전 로딩 구간을 나중에 잘라낸다
await page.goto(`${BASE}/cvs/shorts`, { waitUntil: "networkidle" });
await page.waitForFunction(() => Array.isArray(window.__shortsSlides), null, { timeout: 30_000 }).catch(() => {});
const leadSec = Math.max(0, (Date.now() - recStart) / 1000 - 0.3);
const slides = await page.evaluate(() => window.__shortsSlides || []);
if (!slides.length) {
  console.error("슬라이드가 없습니다 — /cvs/shorts 가 열리는지, 데이터가 있는지 확인하세요.");
  process.exit(1);
}
await page.waitForFunction(() => window.__shortsDone === true, null, { timeout: slides.length * SLIDE_MS + 30_000 });
const video = page.video();
await ctx.close();

const month = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
const outDir = path.join(__dirname, "out", `shorts-${month}`);
fs.mkdirSync(outDir, { recursive: true });
const rawPath = path.join(tmp, "raw.webm");
await video.saveAs(rawPath);
const totalSec = (slides.length * SLIDE_MS) / 1000;

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const hasFfmpeg = spawnSync(FFMPEG, ["-version"], { stdio: "ignore" }).status === 0;
const run = (args) => {
  const r = spawnSync(FFMPEG, ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg 실패");
};
if (hasFfmpeg) {
  // 앞쪽 로딩 구간을 잘라 첫 슬라이드가 0초에 오게 (자막 타이밍과 맞춘다)
  run(["-ss", leadSec.toFixed(2), "-i", rawPath, "-t", totalSec.toFixed(2), "-c:v", "libvpx", "-b:v", "6M", path.join(outDir, "video.webm")]);
  if (BGM) {
    const fadeAt = Math.max(0, totalSec - 2);
    run([
      "-ss", leadSec.toFixed(2), "-i", rawPath,
      "-stream_loop", "-1", "-i", BGM,
      "-t", totalSec.toFixed(2),
      "-map", "0:v", "-map", "1:a",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "20", "-r", "30",
      "-c:a", "aac", "-b:a", "192k", "-af", `afade=t=in:d=0.5,afade=t=out:st=${fadeAt}:d=2`,
      "-movflags", "+faststart",
      path.join(outDir, "final.mp4"),
    ]);
  }
} else {
  fs.copyFileSync(rawPath, path.join(outDir, "video.webm"));
  if (BGM) console.warn("⚠ ffmpeg 가 없어 배경음악을 입히지 못했습니다 (winget install ffmpeg). 무음 video.webm 만 만듭니다.");
  else console.warn(`ℹ ffmpeg 가 없어 앞쪽 ${leadSec.toFixed(1)}초 로딩 구간을 자르지 못했습니다.`);
}

// 썸네일: 첫 버프 장면에서 멈춘 화면
const thumbPage = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const firstBuff = Math.max(0, slides.findIndex((s) => s.kind === "buff"));
await thumbPage.goto(`${BASE}/cvs/shorts?i=${firstBuff}`, { waitUntil: "networkidle" });
await thumbPage.waitForTimeout(800);
await thumbPage.screenshot({ path: path.join(outDir, "thumb.png") });
await browser.close();

// 자막: 녹화는 페이지 로드 직후부터라 약간의 앞 여백이 있다 — 편집기에서 맞추면 된다
const srt = slides
  .map((s, i) => `${i + 1}\n${srtTime(i * SLIDE_MS)} --> ${srtTime((i + 1) * SLIDE_MS - 100)}\n${caption(s)}\n`)
  .join("\n");
fs.writeFileSync(path.join(outDir, "captions.srt"), srt);

const intro = slides[0];
const buffs = slides.filter((s) => s.kind === "buff");
const bests = slides.filter((s) => s.kind === "best");
const versus = slides.filter((s) => s.kind === "versus");
const nerfs = slides.filter((s) => s.kind === "nerf");
const desc = [
  `제목 후보:`,
  buffs.length ? `- ${intro.title} | 1+1 된 것 vs 2+1 된 것 #shorts` : `- ${intro.title} | 같은 상품도 편의점마다 1개당 가격이 다르다 #shorts`,
  `- 이번 달 편의점 행사 버프·너프 총정리 (GS25·CU·세븐·이마트24) #shorts`,
  buffs[0] ? `- ${buffs[0].name} ${buffs[0].to} 됐다?! ${intro.title} #shorts` : null,
  ``,
  `설명:`,
  `${intro.title} — 지난달보다 좋아진(버프)·나빠진(너프) 편의점 행사를 정리했어요.`,
  ``,
  ...buffs.map((s) => `▲ ${s.brand} ${s.name}: ${s.from} → ${s.to} (1개당 ${won(s.fromUnit)} → ${won(s.toUnit)})`),
  ...nerfs.map((s) => `▼ ${s.brand} ${s.name}: ${s.from} → ${s.to} (1개당 ${won(s.fromUnit)} → ${won(s.toUnit)})`),
  ...bests.map((s) => `💰 ${s.cat} 꿀템 — ${s.brand} ${s.name} ${s.t} (1개당 ${won(s.unit)}, ${won(s.saved)} 아낌)`),
  ...versus.map((s) => `🆚 ${s.name} — ${s.offers[0].brand} ${s.offers[0].t}가 1개당 가장 쌈 (${won(s.offers[0].unit)})`),
  ``,
  `전체 행사 목록·어디가 이득인지 비교 → ${BASE}/cvs?utm_source=youtube&utm_medium=video`,
  ``,
  `#편의점행사 #1+1 #2+1 #GS25 #CU #세븐일레븐 #이마트24 #편의점신상 #shorts`,
  BGM_CREDIT ? `\n🎵 Music: ${BGM_CREDIT}` : null,
]
  .filter((l) => l !== null)
  .join("\n");
fs.writeFileSync(path.join(outDir, "description.txt"), desc);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`완료 → ${outDir}`);
