/**
 * 리뷰 없는 상품 목록 — 조회수·클릭 내림차순, 상위 N개 슬러그/제목 출력
 * 실행: node scripts/list-no-review.mjs [N]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const N = Number(process.argv[2] || 20);

if (!existsSync(CONFIG_PATH)) {
  console.error("설정 파일(.toss-config.json)이 없습니다.");
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const token = createHash("sha256").update("ipsomun:" + config.adminPassword + (config.tokenSecret ? ":" + config.tokenSecret : "")).digest("hex");
const headers = { Cookie: `ipsomun_admin=${token}` };

async function main() {
  const res = await fetch(`${config.siteUrl}/api/admin/products?limit=10000`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 오류 ${res.status}`);
  const noReview = data.products.filter((p) => p.isPublished && !p.hasReview);
  noReview.sort((a, b) => (b.clicks || 0) - (a.clicks || 0) || (b.views || 0) - (a.views || 0));
  console.log(`리뷰없음 총 ${noReview.length}개\n`);
  for (const p of noReview.slice(0, N)) {
    console.log(`${p.slug}\t클릭${p.clicks || 0}/조회${p.views || 0}\t${p.title}`);
  }
}

main().catch((e) => {
  console.error("오류:", e.message || e);
  process.exit(1);
});
