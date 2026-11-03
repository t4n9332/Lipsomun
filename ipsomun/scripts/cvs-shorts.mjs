#!/usr/bin/env node
/**
 * 편의점 패치노트 쇼츠 자동 제작 — /cvs/shorts 를 녹화해 영상 + 자막 + 설명문을 만든다.
 *
 *   node scripts/cvs-shorts.mjs                         # 운영 사이트를 녹화
 *   node scripts/cvs-shorts.mjs http://localhost:3000   # 로컬 개발 서버를 녹화
 *
 * 결과 (scripts/out/shorts-YYYY-MM/)
 *   - video.webm      1080×1920 무음 영상 (편집기에서 BGM·효과음을 얹어 업로드)
 *   - captions.srt    장마다 한 줄 자막 (유튜브 자막 업로드 또는 편집기 자막 트랙)
 *   - description.txt 제목 후보·설명·해시태그
 *   - thumb.png       썸네일 후보 (첫 버프 장면)
 *
 * ⚠️ BGM: 다른 영상의 배경음악을 그대로 쓰면 Content ID 에 걸려 수익이 원저작자에게 가거나
 * 영상이 막힌다. 유튜브 오디오 보관함(무료·수익화 가능)이나 라이선스를 산 음원을 쓸 것.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] || "https://lipsomun.co.kr").replace(/\/$/, "");
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
    case "buff": return `버프! ${s.brand} ${s.name} ${s.from}에서 ${s.to}로. 1개당 ${won(s.toUnit)}`;
    case "nerf": return `너프… ${s.brand} ${s.name} ${s.from}에서 ${s.to}로. 1개당 ${won(s.toUnit)}`;
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
await page.goto(`${BASE}/cvs/shorts`, { waitUntil: "networkidle" });
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
await video.saveAs(path.join(outDir, "video.webm"));

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
const nerfs = slides.filter((s) => s.kind === "nerf");
const desc = [
  `제목 후보:`,
  `- ${intro.title} | 1+1 된 것 vs 2+1 된 것 #shorts`,
  `- 이번 달 편의점 행사 버프·너프 총정리 (GS25·CU·세븐·이마트24) #shorts`,
  buffs[0] ? `- ${buffs[0].name} ${buffs[0].to} 됐다?! ${intro.title} #shorts` : null,
  ``,
  `설명:`,
  `${intro.title} — 지난달보다 좋아진(버프)·나빠진(너프) 편의점 행사를 정리했어요.`,
  ``,
  ...buffs.map((s) => `▲ ${s.brand} ${s.name}: ${s.from} → ${s.to} (1개당 ${won(s.toUnit)})`),
  ...nerfs.map((s) => `▼ ${s.brand} ${s.name}: ${s.from} → ${s.to} (1개당 ${won(s.toUnit)})`),
  ``,
  `전체 행사 목록·어디가 이득인지 비교 → ${BASE}/cvs?utm_source=youtube&utm_medium=video`,
  ``,
  `#편의점행사 #1+1 #2+1 #GS25 #CU #세븐일레븐 #이마트24 #편의점신상 #shorts`,
]
  .filter((l) => l !== null)
  .join("\n");
fs.writeFileSync(path.join(outDir, "description.txt"), desc);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`완료 → ${outDir}`);
