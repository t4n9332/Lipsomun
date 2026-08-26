/**
 * 네이버 블로그 초안 자동 생성기
 * ================================================
 * 사이트의 가격비교 상품(쿠팡+토스) 중 절약액이 큰 순으로, 아직 초안을 만들지
 * 않은 상품 1개를 골라 네이버 블로그용 초안(markdown)을 생성합니다.
 * 결과: ../블로그/자동초안-YYYY-MM-DD-상품명.md
 *
 * 실행:  node scripts/blog-draft.mjs        (1개 생성)
 *        node scripts/blog-draft.mjs 3      (3개 생성)
 * toss-auto.bat(매일 09:30)에서 자동으로 1개씩 생성됩니다.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const DONE_PATH = path.join(__dirname, ".blog-drafted.json");
const BLOG_DIR = path.join(__dirname, "..", "..", "블로그");

const COUNT = Math.min(Number(process.argv[2]) || 1, 20);

if (!existsSync(CONFIG_PATH)) {
  console.error("설정 파일(.toss-config.json)이 없습니다. toss-playwright.mjs를 먼저 1회 실행하세요.");
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const token = createHash("sha256").update("ipsomun:" + config.adminPassword).digest("hex");

const won = (n) => (n != null ? Number(n).toLocaleString("ko-KR") + "원" : "");
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function loadDone() {
  try {
    return JSON.parse(readFileSync(DONE_PATH, "utf8"));
  } catch {
    return [];
  }
}

/**
 * 토스 링크가 없는 인기 상품용 단일 소개 글.
 * 가격비교가 성립하지 않으므로 '가격 추이 + 구매 판단' 쪽으로 각을 잡는다.
 * 네이버는 정형화된 글을 싫어하므로 비교 글과 구조를 일부러 다르게 둔다.
 */
function draftSingle(p, cPrice) {
  const url = `https://lipsomun.co.kr/p/${encodeURIComponent(p.slug)}`;
  const shortName = p.title.split(",")[0].trim();
  const cat = p.category && p.category !== "기타" ? p.category : null;
  const ratingLine =
    p.rating && p.ratingCount
      ? `\n실구매자 평점은 **${p.rating}점(리뷰 ${Number(p.ratingCount).toLocaleString("ko-KR")}개)** 입니다.\n`
      : "";

  return `# [자동 초안 ${today}] ${shortName} — 살까 말까 정리

> 추천 제목(택1):
> - ${shortName} 가격 지금 얼마? 사기 전 확인할 것
> - ${shortName} 최저가 확인하고 샀습니다
> - ${shortName}, 지금이 살 때인지 가격부터 봤습니다

---

(💡 첫 문단은 직접 쓰세요 — 왜 이걸 찾아봤는지, 어떤 상황이었는지 2~3줄.
네이버는 도입부의 실제 경험 유무로 글의 성격을 판단합니다. 이 블록을 비워두고
발행하면 상위 노출이 거의 안 됩니다.)

## 오늘 가격

**${p.title}**
현재 쿠팡 기준 **${won(cPrice)}** 입니다.${ratingLine}

생필품은 가격이 자주 흔들려서, 평소 가격을 알아두면 지금이 살 때인지 판단하기 쉽습니다.
아래 페이지에 이 상품의 가격 변동 그래프와 역대 최저가를 정리해뒀습니다.

👉 **${shortName} 가격 확인**: ${url}

## 살 때 확인할 것

(💡 아래 3줄은 직접 겪은 내용으로 바꾸면 글의 질이 크게 올라갑니다)

- 용량·수량 단위가 다른 상품이 섞여 있으니 개당 가격으로 비교하세요
- 쿠폰 적용가는 계정마다 다를 수 있어 결제 직전 금액을 확인하세요
- 정기배송·묶음 옵션이 더 싼 경우가 있습니다
${cat ? `\n${cat} 카테고리의 다른 인기 상품도 모아뒀습니다: https://lipsomun.co.kr/category/${encodeURIComponent(p.category)}\n` : ""}
---
*이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.*

> 태그 추천: #${shortName.replace(/\s+/g, "")} #최저가 #쿠팡${cat ? ` #${cat.replace(/[\s/]/g, "")}` : ""} #가격비교 #생활꿀팁
`;
}

function draft(p, cPrice, tPrice) {
  if (tPrice == null) return draftSingle(p, cPrice);
  const cheaperName = tPrice < cPrice ? "토스쇼핑" : "쿠팡";
  const low = Math.min(cPrice, tPrice);
  const high = Math.max(cPrice, tPrice);
  const savings = high - low;
  // 슬러그가 한글이라 인코딩하지 않으면 붙여넣었을 때 깨지거나 400이 난다
  const url = `https://lipsomun.co.kr/p/${encodeURIComponent(p.slug)}`;
  const shortName = p.title.split(",")[0].trim();
  const ratingLine =
    p.rating && p.ratingCount
      ? `실구매자 평점도 **${p.rating}점(리뷰 ${Number(p.ratingCount).toLocaleString("ko-KR")}개)** 으로 검증된 제품입니다.\n\n`
      : "";

  return `# [자동 초안 ${today}] ${shortName} — 쿠팡 vs 토스 가격비교

> 추천 제목(택1):
> - ${shortName} 최저가, 쿠팡 말고 여기가 더 쌌습니다 (${won(savings)} 차이)
> - ${shortName} 어디서 살까? 쿠팡 vs 토스쇼핑 가격비교
> - ${shortName} 사기 전에 30초만 — 가격 비교하고 ${won(savings)} 아끼기

---

안녕하세요! 오늘은 **${p.title}** 가격을 쿠팡과 토스쇼핑 양쪽에서 비교해봤습니다.

## 오늘 가격 비교 결과

| 판매처 | 가격 |
|---|---|
| 쿠팡 | ${won(cPrice)} |
| 토스쇼핑 | ${won(tPrice)} |

같은 상품인데 **${cheaperName}이 ${won(savings)} 더 저렴**하네요. 이런 차이는 쿠폰·프로모션에 따라 수시로 바뀌기 때문에, 사기 직전에 한 번 비교해보는 게 좋습니다.

(💡 여기에 이 제품을 왜 찾아봤는지, 써본 경험이 있다면 한두 줄 추가하세요 — 네이버는 실제 경험이 담긴 글을 상위에 올려줍니다)

${ratingLine}## 실시간 가격은 여기서

가격은 계속 바뀌니, 실시간 비교는 아래 페이지에서 확인하세요. 두 판매처 버튼이 나란히 있어 더 싼 곳으로 바로 갈 수 있습니다.

👉 **${shortName} 쿠팡 vs 토스 실시간 가격비교**: ${url}

다른 인기 상품들의 가격비교도 모아뒀습니다: https://lipsomun.co.kr/compare

## 정리

- 오늘 기준 ${cheaperName}이 ${won(savings)} 저렴
- 쿠폰 보유에 따라 가격 변동이 있으니 구매 직전 재확인 추천
- 가격비교 페이지 즐겨찾기 해두면 편합니다

---
*이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다. 또한 토스쇼핑 쉐어링크 활동의 일환으로, 링크를 통한 구매가 발생하면 일정 수수료를 지급받습니다.*

> 태그 추천: #${shortName.replace(/\s+/g, "")} #가격비교 #최저가 #쿠팡최저가 #토스쇼핑 #할인정보 #오늘의특가
`;
}

async function main() {
  const res = await fetch(`${config.siteUrl}/api/admin/products?limit=1000`, {
    headers: { Cookie: `ipsomun_admin=${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 오류 ${res.status}`);

  const done = loadDone();
  const rows = data.products
    .filter((p) => p.isPublished && !done.includes(p.slug))
    .map((p) => {
      const c = p.links.find((l) => l.platform === "coupang");
      const t = p.links.find((l) => l.platform === "toss");
      const cPrice = c ? (c.price ?? p.price) : null;
      const tPrice = t ? t.price : null;
      return { p, cPrice, tPrice };
    });

  // 1순위: 가격차가 있는 토스 가격비교 상품 (수수료 10%, 비교 글이 성립)
  const tier1 = rows
    .filter((x) => x.cPrice != null && x.tPrice != null && x.cPrice !== x.tPrice)
    .sort((a, b) => Math.abs(b.cPrice - b.tPrice) - Math.abs(a.cPrice - a.tPrice));

  // 2순위: 토스 링크가 없어도 사이트에서 실제로 클릭이 많이 난 상품.
  // 토스 상품이 12개뿐이라 1순위만 쓰면 열흘이면 후보가 고갈된다.
  // 이쪽은 가격비교가 아닌 단일 상품 소개 글로 나간다.
  const tier2 = rows
    .filter((x) => x.cPrice != null && !tier1.some((t) => t.p.slug === x.p.slug))
    .filter((x) => (x.p.clicks || 0) > 0)
    .sort((a, b) => (b.p.clicks || 0) - (a.p.clicks || 0));

  const candidates = [...tier1, ...tier2];
  if (candidates.length === 0) {
    console.log("초안을 만들 새 상품이 없습니다.");
    return;
  }
  console.log(
    `후보 ${candidates.length}개 (가격비교 ${tier1.length} / 인기상품 ${tier2.length}) 중 ${Math.min(COUNT, candidates.length)}개 생성`
  );

  mkdirSync(BLOG_DIR, { recursive: true });
  for (const { p, cPrice, tPrice } of candidates.slice(0, COUNT)) {
    // 같은 날 다른 상품이 같은 파일명을 덮어쓰지 않도록 용량/수량을 함께 붙인다
    const parts = p.title.split(",").map((s) => s.trim());
    const spec = parts.slice(1).find((s) => /\d/.test(s)) || "";
    const base = `${parts[0]}${spec ? ` ${spec}` : ""}`.replace(/[\\/:*?"<>|]/g, "").slice(0, 30);
    let safe = base;
    for (let n = 2; existsSync(path.join(BLOG_DIR, `자동초안-${today}-${safe}.md`)); n++) safe = `${base}-${n}`;
    const file = path.join(BLOG_DIR, `자동초안-${today}-${safe}.md`);
    writeFileSync(file, draft(p, cPrice, tPrice), "utf8");
    done.push(p.slug);
    console.log(`✔ 초안 생성: ${file}`);
  }
  writeFileSync(DONE_PATH, JSON.stringify(done, null, 2));
}

main().catch((e) => {
  console.error("오류:", e.message || e);
  process.exit(1);
});
