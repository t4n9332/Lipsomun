/**
 * 카테고리 일괄 재분류 도구
 * - scripts/recategorize.json 의 { slug: 카테고리 } 매핑을 사이트에 적용
 *   (링크·리뷰·가격 등 다른 필드는 건드리지 않음)
 * - 실행:  node scripts/apply-categories.mjs [매핑파일]
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const MAP_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, "recategorize.json");

if (!existsSync(CONFIG_PATH)) {
  console.error("설정 파일(.toss-config.json)이 없습니다.");
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const token = createHash("sha256").update("ipsomun:" + config.adminPassword).digest("hex");
const headers = { "Content-Type": "application/json", Cookie: `ipsomun_admin=${token}` };

async function main() {
  const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
  const res = await fetch(`${config.siteUrl}/api/admin/products?limit=1000`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 오류 ${res.status}`);
  const bySlug = new Map(data.products.map((p) => [p.slug, p]));

  let ok = 0;
  let skip = 0;
  let same = 0;
  for (const [slug, category] of Object.entries(map)) {
    const p = bySlug.get(slug);
    if (!p) {
      console.log(`  ↷ [${slug}] 사이트에서 상품을 찾지 못함`);
      skip++;
      continue;
    }
    if (p.category === category) {
      same++;
      continue;
    }
    const post = await fetch(`${config.siteUrl}/api/admin/category`, {
      method: "POST",
      headers,
      body: JSON.stringify({ productId: p.id, category }),
    });
    const pd = await post.json().catch(() => ({}));
    if (post.ok) {
      ok++;
      console.log(`  ✔ ${p.category} → ${category} : ${p.title.slice(0, 38)}`);
    } else {
      skip++;
      console.log(`  ✘ 실패 [${slug}]: ${pd.error || post.status}`);
    }
  }
  console.log(`\n완료 — 변경 ${ok}개, 이미 일치 ${same}개, 건너뜀/실패 ${skip}개`);
}

main().catch((e) => {
  console.error("오류:", e.message || e);
  process.exit(1);
});
