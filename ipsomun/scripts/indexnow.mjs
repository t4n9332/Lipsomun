/**
 * IndexNow 자동 제출 — 네이버·빙 등 참여 검색엔진에 변경된 URL을 알린다.
 * ====================================================================
 * sitemap.xml을 읽어 이전 제출 스냅샷(.indexnow-submitted.json)과 비교,
 * 신규·변경된 URL만 api.indexnow.org 공용 엔드포인트로 제출한다
 * (한 번 제출하면 모든 참여 엔진에 공유됨 — Naver, Bing, Seznam, Yandex).
 *
 * 구글은 IndexNow 미참여 → 서치콘솔 사이트맵 제출은 여전히 수동.
 *
 * 실행: node scripts/indexnow.mjs        (toss-auto.bat에서 매일 자동 실행)
 *       node scripts/indexnow.mjs --all  (스냅샷 무시하고 전체 재제출)
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const SNAPSHOT_PATH = path.join(__dirname, ".indexnow-submitted.json");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

/** 항상 함께 제출하는 페이지 — 매일 내용이 바뀌는 목록형 페이지들 */
const ALWAYS_FRESH = ["/", "/compare", "/deals", "/ranking", "/blog"];

function findKey() {
  // public/ 안의 32자리 hex 이름 .txt 파일이 IndexNow 키 파일이다
  const f = readdirSync(PUBLIC_DIR).find((n) => /^[0-9a-f]{32}\.txt$/.test(n));
  if (!f) throw new Error("public/에 IndexNow 키 파일(<32-hex>.txt)이 없습니다");
  return f.replace(/\.txt$/, "");
}

async function main() {
  const submitAll = process.argv.includes("--all");
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const base = cfg.siteUrl.replace(/\/$/, "");
  const host = new URL(base).host;
  const key = findKey();

  // 사이트맵에서 URL + lastmod 수집
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  const entries = {};
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>(.*?)<\/loc>/)?.[1];
    if (!loc) continue;
    const lastmod = m[1].match(/<lastmod>(.*?)<\/lastmod>/)?.[1] || "";
    entries[loc] = lastmod;
  }
  const total = Object.keys(entries).length;
  if (total === 0) throw new Error("sitemap.xml에서 URL을 찾지 못했습니다");

  // 이전 스냅샷과 비교해 신규·변경 URL만 추린다
  let prev = {};
  if (!submitAll) {
    try {
      prev = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    } catch {}
  }
  const changed = Object.entries(entries)
    .filter(([url, lastmod]) => prev[url] === undefined || prev[url] !== lastmod)
    .map(([url]) => url);
  const alwaysFresh = ALWAYS_FRESH.map((p) => (p === "/" ? base : base + p));
  const urlList = [...new Set([...changed, ...alwaysFresh])].slice(0, 10000);

  if (changed.length === 0) {
    console.log(`[IndexNow] 변경된 URL 없음 (사이트맵 ${total}개) — 목록형 ${alwaysFresh.length}개만 제출`);
  } else {
    console.log(`[IndexNow] 사이트맵 ${total}개 중 신규·변경 ${changed.length}개 제출`);
  }

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `${base}/${key}.txt`,
      urlList,
    }),
  });
  // 200/202 = 접수됨. 4xx면 키 파일 미배포 등 — 스냅샷을 갱신하지 않아 다음에 재시도된다.
  if (res.status === 200 || res.status === 202) {
    console.log(`[IndexNow] 제출 완료 (${urlList.length}개, HTTP ${res.status})`);
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(entries, null, 1));
  } else {
    console.log(`[IndexNow] 제출 실패 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("[IndexNow] 오류:", e.message || e);
  process.exitCode = 1;
});
