/**
 * 정리형 리뷰 일괄 적용 도구
 * - scripts/reviews-batch.json의 리뷰를 사이트 상품에 부분 업데이트로 적용
 *   (링크·가격 등 다른 필드는 건드리지 않음)
 * - 실행:  node scripts/apply-reviews.mjs
 * - 새 리뷰가 필요하면 Claude에게 "상위 상품 리뷰 10개 더 만들어줘"라고 요청해
 *   reviews-batch.json을 갱신한 뒤 다시 실행하면 됩니다.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const BATCH_PATH = path.join(__dirname, "reviews-batch.json");

if (!existsSync(CONFIG_PATH)) {
  console.error("설정 파일(.toss-config.json)이 없습니다. toss-playwright.mjs를 먼저 1회 실행하세요.");
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const token = createHash("sha256").update("ipsomun:" + config.adminPassword).digest("hex");
const headers = { "Content-Type": "application/json", Cookie: `ipsomun_admin=${token}` };

async function main() {
  const batch = JSON.parse(readFileSync(BATCH_PATH, "utf8"));
  const res = await fetch(`${config.siteUrl}/api/admin/products?limit=1000`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 오류 ${res.status}`);
  const bySlug = new Map(data.products.map((p) => [p.slug, p]));

  let ok = 0;
  let skip = 0;
  for (const r of batch) {
    const p = bySlug.get(r.slug);
    if (!p) {
      console.log(`  ↷ [${r.slug}] 사이트에서 상품을 찾지 못함`);
      skip++;
      continue;
    }
    const post = await fetch(`${config.siteUrl}/api/admin/review`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        productId: p.id,
        review: r.review,
        pros: r.pros || "",
        cons: r.cons || "",
        description: r.description || "",
      }),
    });
    const pd = await post.json().catch(() => ({}));
    if (post.ok) {
      ok++;
      console.log(`  ✔ 리뷰 적용: ${p.title.slice(0, 40)}`);
    } else {
      skip++;
      console.log(`  ✘ 실패 [${r.slug}]: ${pd.error || post.status}`);
    }
  }
  console.log(`\n완료 — 적용 ${ok}개, 건너뜀/실패 ${skip}개`);
}

main().catch((e) => {
  console.error("오류:", e.message || e);
  process.exit(1);
});
