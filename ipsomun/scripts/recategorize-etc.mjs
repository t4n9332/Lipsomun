/**
 * '기타' 카테고리 정리 도구
 * ========================
 * 역매칭으로 신규 등록된 상품 중 토스 카테고리 정보가 없던 것들은 '기타'로
 * 떨어진다. 이 도구는 상품명에 CATEGORY_RULES(lib-category.mjs)를 다시 적용해
 * 사이트 카테고리 10종으로 재분류할 매핑을 만든다.
 *
 * '기타'는 사이트맵의 카테고리 페이지에서 제외되므로, 여기 쌓인 상품은 내부
 * 링크가 약해져 색인에 불리하다. 주기적으로 비워주는 게 좋다.
 *
 * 실행:
 *   node scripts/recategorize-etc.mjs            # 미리보기만 (아무것도 안 바꿈)
 *   node scripts/recategorize-etc.mjs --write    # 매핑 파일로 저장
 *   node scripts/recategorize-etc.mjs --apply    # 저장 + 사이트에 바로 적용
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteCategoryFor, FALLBACK_CATEGORY } from "./lib-category.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const OUT_PATH = path.join(__dirname, "recategorize-etc.json");

const WRITE = process.argv.includes("--write") || process.argv.includes("--apply");
const APPLY = process.argv.includes("--apply");

if (!existsSync(CONFIG_PATH)) {
  console.error("설정 파일(.toss-config.json)이 없습니다.");
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const token = createHash("sha256").update("ipsomun:" + config.adminPassword).digest("hex");
const headers = { "Content-Type": "application/json", Cookie: `ipsomun_admin=${token}` };

async function main() {
  const res = await fetch(`${config.siteUrl}/api/admin/products?limit=2000`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 오류 ${res.status}`);

  // 비공개 상품(숙박·입장권 등 제목만으로 특정 불가한 항목)은 건드리지 않는다
  const etc = data.products.filter((p) => p.category === FALLBACK_CATEGORY && p.isPublished);
  const hidden = data.products.filter((p) => p.category === FALLBACK_CATEGORY && !p.isPublished);
  console.log(
    `전체 ${data.products.length}개 중 '${FALLBACK_CATEGORY}' ${etc.length}개` +
      (hidden.length ? ` (비공개 ${hidden.length}개는 제외)` : "") +
      "\n"
  );

  const map = {};
  const byCat = {};
  const unresolved = [];
  for (const p of etc) {
    // 토스 카테고리 정보는 없으니 상품명만으로 판정한다
    const cat = siteCategoryFor(null, p.title);
    if (cat === FALLBACK_CATEGORY) {
      unresolved.push(p.title);
      continue;
    }
    map[p.slug] = cat;
    (byCat[cat] ||= []).push(p.title);
  }

  for (const [cat, titles] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`[${cat}] ${titles.length}개`);
    for (const t of titles) console.log(`    ${t.slice(0, 60)}`);
    console.log("");
  }
  console.log(`분류됨 ${Object.keys(map).length}개 · 여전히 '${FALLBACK_CATEGORY}' ${unresolved.length}개`);
  if (unresolved.length) {
    console.log(`\n[${FALLBACK_CATEGORY} 잔류] 규칙에 안 걸린 상품 — 키워드 보강 후보`);
    for (const t of unresolved) console.log(`    ${t.slice(0, 60)}`);
  }

  if (!WRITE) {
    console.log("\n※ 미리보기입니다. 저장하려면 --write, 바로 적용하려면 --apply");
    return;
  }
  writeFileSync(OUT_PATH, JSON.stringify(map, null, 2) + "\n");
  console.log(`\n✔ 매핑 저장: ${OUT_PATH}`);
  if (!APPLY) {
    console.log("적용:  node scripts/apply-categories.mjs scripts/recategorize-etc.json");
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const [slug, category] of Object.entries(map)) {
    const p = data.products.find((x) => x.slug === slug);
    const post = await fetch(`${config.siteUrl}/api/admin/category`, {
      method: "POST",
      headers,
      body: JSON.stringify({ productId: p.id, category }),
    });
    if (post.ok) {
      ok++;
    } else {
      fail++;
      const pd = await post.json().catch(() => ({}));
      console.log(`  ✘ 실패 [${slug}]: ${pd.error || post.status}`);
    }
  }
  console.log(`\n✔ 적용 완료 — 성공 ${ok}개 · 실패 ${fail}개`);
}

main().catch((e) => {
  console.error("오류:", e.message);
  process.exit(1);
});
