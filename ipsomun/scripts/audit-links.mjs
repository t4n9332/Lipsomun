/**
 * 가격비교 링크 감사 도구 v2 — 오매칭(용량 다른 상품끼리 묶임) 탐지·정리
 *
 * 검증 방식 (2단계):
 *  1) 가격차 2.2배 이상 → 즉시 오매칭 판정
 *  2) 가격차 1.3배 이상(의심 구간) → 토스 링크가 실제 가리키는 상품 페이지의
 *     제목(og:title)을 가져와 사이트 상품명과 수량·용량 토큰을 직접 대조
 *     - 숫자 토큰(60정, 500ml, 3개 등)이 불일치하면 오매칭 판정
 *
 * 실행:  node scripts/audit-links.mjs          (탐지만)
 *        node scripts/audit-links.mjs --fix    (탐지 + 오매칭 토스 링크 제거)
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const HARD_RATIO = 2.2; // 이 이상은 무조건 오매칭
const CHECK_RATIO = 1.3; // 이 이상은 실제 상품 제목 대조
const FIX = process.argv.includes("--fix");

if (!existsSync(CONFIG_PATH)) {
  console.error("설정 파일(.toss-config.json)이 없습니다.");
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const token = createHash("sha256").update("ipsomun:" + config.adminPassword).digest("hex");
const headers = { "Content-Type": "application/json", Cookie: `ipsomun_admin=${token}` };
const won = (n) => (n != null ? Number(n).toLocaleString("ko-KR") + "원" : "?");

function tokenize(title) {
  return (title || "")
    .toLowerCase()
    .replace(/[^\w가-힣.]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** 숫자 토큰 일치도: {agree: 완전일치 여부, detail: "a측/b측"} */
function numericCompare(a, b) {
  const numsA = [...new Set(tokenize(a).filter((t) => /\d/.test(t)))];
  const numsB = [...new Set(tokenize(b).filter((t) => /\d/.test(t)))];
  if (numsA.length === 0 && numsB.length === 0) return { agree: true, detail: "숫자 없음" };
  const setB = new Set(numsB);
  const inter = numsA.filter((t) => setB.has(t)).length;
  const union = new Set([...numsA, ...numsB]).size;
  return {
    agree: inter === union,
    detail: `사이트[${numsA.join(",") || "-"}] vs 토스[${numsB.join(",") || "-"}]`,
  };
}

/** 토스 쉐어링크가 실제 가리키는 상품 제목 가져오기 */
async function fetchTossTitle(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    const html = (await res.text()).slice(0, 200_000);
    const m =
      html.match(/property="og:title"[^>]*content="([^"]*)"/) ||
      html.match(/content="([^"]*)"[^>]*property="og:title"/);
    return m ? m[1].replace(/\s*\|\s*토스쇼핑\s*$/, "").trim() : null;
  } catch {
    return null;
  }
}

async function removeTossLink(productId) {
  const del = await fetch(`${config.siteUrl}/api/admin/links`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ productId, platform: "toss" }),
  });
  return del.ok;
}

async function main() {
  const res = await fetch(`${config.siteUrl}/api/admin/products?limit=1000`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 오류 ${res.status}`);

  let bad = 0;
  let checked = 0;
  let ok = 0;
  for (const p of data.products) {
    const c = p.links.find((l) => l.platform === "coupang");
    const t = p.links.find((l) => l.platform === "toss");
    if (!c || !t) continue;
    const cPrice = c.price ?? p.price;
    const tPrice = t.price;
    if (cPrice == null || tPrice == null || cPrice <= 0 || tPrice <= 0) continue;
    const ratio = Math.max(cPrice, tPrice) / Math.min(cPrice, tPrice);

    if (ratio >= HARD_RATIO) {
      bad++;
      console.log(`  ✘ [${ratio.toFixed(1)}배·즉시판정] ${p.title.slice(0, 44)}`);
      console.log(`     쿠팡 ${won(cPrice)} vs 토스 ${won(tPrice)}`);
      if (FIX) console.log((await removeTossLink(p.id)) ? "     → 토스 링크 제거" : "     → 제거 실패");
      continue;
    }

    if (ratio >= CHECK_RATIO) {
      checked++;
      const tossTitle = await fetchTossTitle(t.url);
      if (!tossTitle) {
        console.log(`  ? [${ratio.toFixed(1)}배] ${p.title.slice(0, 44)} — 토스 상품 제목 확인 실패 (수동 확인 필요)`);
        continue;
      }
      const cmp = numericCompare(p.title, tossTitle);
      if (!cmp.agree) {
        bad++;
        console.log(`  ✘ [${ratio.toFixed(1)}배·수량 불일치] ${p.title.slice(0, 44)}`);
        console.log(`     쿠팡 ${won(cPrice)} vs 토스 ${won(tPrice)}`);
        console.log(`     토스 실제 상품: ${tossTitle.slice(0, 50)}`);
        console.log(`     숫자 대조: ${cmp.detail}`);
        if (FIX) console.log((await removeTossLink(p.id)) ? "     → 토스 링크 제거" : "     → 제거 실패");
      } else {
        ok++;
        console.log(`  ✓ [${ratio.toFixed(1)}배·정상특가] ${p.title.slice(0, 40)} (수량 일치: ${cmp.detail})`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  console.log(
    `\n완료 — 오매칭 ${bad}개${FIX ? " 제거" : " 발견"}, 의심구간 검증 ${checked}개 중 정상 ${ok}개`
  );
  if (!FIX && bad > 0) console.log("제거하려면:  node scripts/audit-links.mjs --fix");
}

main().catch((e) => {
  console.error("오류:", e.message || e);
  process.exit(1);
});
