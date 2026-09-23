/**
 * 가지치기 — 아무도 안 보는 얇은 상품을 비공개로 돌린다 (삭제 아님, 되돌릴 수 있음).
 * 대상: 리뷰 없음(이미 noindex) + 조회 0 + 클릭 0 + 쿠팡 단독 + 딜 아님 + 등록 MIN_AGE_DAYS일 경과.
 *   node scripts/prune-products.mjs            미리보기
 *   node scripts/prune-products.mjs --write    비공개 전환 (+ 목록을 .pruned-YYYY-MM-DD.json에 저장)
 *   node scripts/prune-products.mjs --restore scripts/.pruned-YYYY-MM-DD.json   되돌리기
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(__dirname, ".toss-config.json"), "utf8"));
const token = createHash("sha256").update("ipsomun:" + config.adminPassword + (config.tokenSecret ? ":" + config.tokenSecret : "")).digest("hex");
const headers = { "Content-Type": "application/json", Cookie: `ipsomun_admin=${token}` };
const MIN_AGE_DAYS = 14;

async function setPublished(productId, published) {
  const r = await fetch(`${config.siteUrl}/api/admin/publish`, {
    method: "POST",
    headers,
    body: JSON.stringify({ productId, published }),
  });
  return r.ok;
}

const restoreIdx = process.argv.indexOf("--restore");
if (restoreIdx > -1) {
  const list = JSON.parse(readFileSync(path.resolve(process.argv[restoreIdx + 1]), "utf8"));
  let ok = 0;
  for (const p of list) if (await setPublished(p.id, true)) ok++;
  console.log(`되돌림 ${ok}/${list.length}개`);
  process.exit(0);
}

const res = await fetch(`${config.siteUrl}/api/admin/products?limit=20000`, { headers });
const { products } = await res.json();
const cutoff = Date.now() - MIN_AGE_DAYS * 24 * 3600 * 1000;
const published = products.filter((p) => p.isPublished);
const targets = published.filter(
  (p) =>
    !p.hasReview &&
    !p.views &&
    !p.clicks &&
    !p.isDeal &&
    p.links.length === 1 &&
    p.links[0].platform === "coupang" &&
    new Date(p.createdAt).getTime() < cutoff
);

const byCat = {};
for (const p of targets) byCat[p.category] = (byCat[p.category] || 0) + 1;
console.log(`게시 ${published.length}개 중 대상 ${targets.length}개 → 남는 상품 ${published.length - targets.length}개`);
console.log(`(리뷰없음 전체 ${published.filter((p) => !p.hasReview).length}개)`);
console.log("카테고리별:", byCat);
console.log("샘플:");
for (const p of targets.slice(0, 12)) console.log(`  ${String(p.createdAt).slice(0, 10)}  ${p.title.slice(0, 50)}`);

if (process.argv.includes("--write")) {
  const file = path.join(__dirname, `.pruned-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(file, JSON.stringify(targets.map((p) => ({ id: p.id, slug: p.slug, title: p.title })), null, 2));
  let ok = 0;
  for (const p of targets) if (await setPublished(p.id, false)) ok++;
  console.log(`\n비공개 전환 ${ok}/${targets.length}개 — 되돌리기: node scripts/prune-products.mjs --restore ${path.relative(process.cwd(), file)}`);
}
