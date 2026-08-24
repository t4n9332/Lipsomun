/**
 * 가격비교 링크 감사 도구 — 오매칭(용량 다른 상품끼리 묶임) 탐지·정리
 * - 쿠팡·토스 가격이 2배 이상 차이나는 상품의 토스 링크를 제거
 * - 실행:  node scripts/audit-links.mjs          (탐지만, 제거 안 함)
 *          node scripts/audit-links.mjs --fix    (탐지 + 토스 링크 제거)
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const RATIO = 2.0;
const FIX = process.argv.includes("--fix");

if (!existsSync(CONFIG_PATH)) {
  console.error("설정 파일(.toss-config.json)이 없습니다.");
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const token = createHash("sha256").update("ipsomun:" + config.adminPassword).digest("hex");
const headers = { "Content-Type": "application/json", Cookie: `ipsomun_admin=${token}` };
const won = (n) => (n != null ? Number(n).toLocaleString("ko-KR") + "원" : "?");

async function main() {
  const res = await fetch(`${config.siteUrl}/api/admin/products?limit=1000`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 오류 ${res.status}`);

  const suspects = [];
  for (const p of data.products) {
    const c = p.links.find((l) => l.platform === "coupang");
    const t = p.links.find((l) => l.platform === "toss");
    if (!c || !t) continue;
    const cPrice = c.price ?? p.price;
    const tPrice = t.price;
    if (cPrice == null || tPrice == null || cPrice <= 0 || tPrice <= 0) continue;
    const ratio = Math.max(cPrice, tPrice) / Math.min(cPrice, tPrice);
    if (ratio >= RATIO) suspects.push({ p, cPrice, tPrice, ratio });
  }

  if (suspects.length === 0) {
    console.log("가격차 2배 이상인 오매칭 의심 상품이 없습니다. ✓");
    return;
  }
  console.log(`오매칭 의심 상품 ${suspects.length}개 (가격차 ${RATIO}배 이상):\n`);
  for (const s of suspects.sort((a, b) => b.ratio - a.ratio)) {
    console.log(
      `  ⚠ [${s.ratio.toFixed(1)}배] ${s.p.title.slice(0, 44)}\n     쿠팡 ${won(s.cPrice)} vs 토스 ${won(s.tPrice)}`
    );
    if (FIX) {
      const del = await fetch(`${config.siteUrl}/api/admin/links`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ productId: s.p.id, platform: "toss" }),
      });
      console.log(del.ok ? "     → 토스 링크 제거 완료" : `     → 제거 실패 (${del.status})`);
    }
  }
  if (!FIX) console.log("\n제거하려면:  node scripts/audit-links.mjs --fix");
}

main().catch((e) => {
  console.error("오류:", e.message || e);
  process.exit(1);
});
