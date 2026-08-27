/**
 * ISR 캐시 워밍 — 사이트맵의 모든 페이지를 미리 생성해 둔다.
 * ================================================================
 * 캐시가 비어 있으면 첫 방문자(또는 크롤러)가 페이지 생성이 끝날 때까지
 * 몇 초를 기다린다. 미리 한 번씩 요청해 두면 모두 즉시 응답을 받는다.
 *
 * ⚠️ HTML만 받는다. 브라우저로 워밍하면 페이지마다 이미지 수십 장을 함께
 *    받아오는데, 그게 Vercel 이미지 최적화 할당량을 태워 사이트 전체 이미지가
 *    402로 깨진 적이 있다(2026-08-26). fetch는 HTML만 가져오므로 안전하다.
 *
 * 실행: node scripts/warm-cache.mjs [동시요청수] [--images]
 *       --images 를 주면 이미지 프록시(wsrv.nl) 캐시까지 예열한다.
 */

const SITE = "https://lipsomun.co.kr";
const CONCURRENCY = Math.min(Math.max(Number(process.argv[2]) || 6, 1), 12);

async function fetchSitemapUrls() {
  const res = await fetch(`${SITE}/sitemap.xml`);
  if (!res.ok) throw new Error(`사이트맵 요청 실패 HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

/** 주어진 URL 목록을 동시 CONCURRENCY로 훑는다. 반환: {ok, failures} */
async function warmAll(urls, label, headers) {
  let done = 0;
  let ok = 0;
  const failures = [];
  let cursor = 0;

  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(45000) });
        if (res.ok) ok++;
        else failures.push(`${res.status} ${url.slice(0, 80)}`);
        await res.arrayBuffer(); // 본문까지 받아야 생성·변환이 끝난다
      } catch (e) {
        failures.push(`ERR ${e.name} ${url.slice(0, 80)}`);
      }
      done++;
      if (done % 100 === 0) console.log(`  [${label}] ${done}/${urls.length} (성공 ${ok})`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { ok, failures };
}

/** 워밍한 HTML에서 이미지 프록시 URL을 모아 함께 데운다 */
async function collectImageUrls(pageUrls) {
  const found = new Set();
  let cursor = 0;
  async function worker() {
    while (cursor < pageUrls.length) {
      const u = pageUrls[cursor++];
      try {
        const html = await (
          await fetch(u, { headers: { accept: "text/html" }, signal: AbortSignal.timeout(30000) })
        ).text();
        for (const m of html.matchAll(/src="(https:\/\/wsrv\.nl\/[^"]+)"/g)) {
          found.add(m[1].replace(/&amp;/g, "&"));
        }
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return [...found];
}

async function main() {
  const withImages = process.argv.includes("--images");
  const urls = await fetchSitemapUrls();
  if (urls.length === 0) throw new Error("사이트맵에서 URL을 찾지 못했습니다");
  console.log(`[워밍] 페이지 ${urls.length}개 · 동시 ${CONCURRENCY}`);

  const page = await warmAll(urls, "페이지", {
    // HTML만 받는다 — 이미지·스크립트는 요청하지 않는다
    accept: "text/html",
    "user-agent": "ipsomun-cache-warmer",
  });
  console.log(`[워밍] 페이지 완료 — 성공 ${page.ok}/${urls.length}`);

  let img = { ok: 0, failures: [] };
  if (withImages) {
    // 이미지 프록시는 첫 변환에 1~2초가 걸린다. 미리 데워두면 방문자는 캐시본을 받는다.
    // 프록시(wsrv.nl)에는 우리 쪽 할당량이 없어 Vercel 이미지 최적화와 달리 안전하다.
    const imgUrls = await collectImageUrls(urls);
    console.log(`[워밍] 이미지 ${imgUrls.length}개 수집 — 프록시 캐시 예열 시작`);
    img = await warmAll(imgUrls, "이미지", { "user-agent": "ipsomun-cache-warmer" });
    console.log(`[워밍] 이미지 완료 — 성공 ${img.ok}/${imgUrls.length}`);
  }

  const failures = [...page.failures, ...img.failures];
  if (failures.length) {
    console.log(`[워밍] 실패 ${failures.length}건:`);
    failures.slice(0, 15).forEach((f) => console.log(`  ${f}`));
    if (failures.length > 15) console.log(`  … 외 ${failures.length - 15}건`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("[워밍] 오류:", e.message || e);
  process.exitCode = 1;
});
