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

const COUNT = Math.min(Number(process.argv[2]) || 1, 5);

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

function draft(p, cPrice, tPrice) {
  const cheaperName = tPrice < cPrice ? "토스쇼핑" : "쿠팡";
  const low = Math.min(cPrice, tPrice);
  const high = Math.max(cPrice, tPrice);
  const savings = high - low;
  const url = `https://lipsomun.co.kr/p/${p.slug}`;
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
  const candidates = data.products
    .filter((p) => p.isPublished && !done.includes(p.slug))
    .map((p) => {
      const c = p.links.find((l) => l.platform === "coupang");
      const t = p.links.find((l) => l.platform === "toss");
      const cPrice = c ? (c.price ?? p.price) : null;
      const tPrice = t ? t.price : null;
      return { p, cPrice, tPrice };
    })
    .filter((x) => x.cPrice != null && x.tPrice != null && x.cPrice !== x.tPrice)
    .sort((a, b) => Math.abs(b.cPrice - b.tPrice) - Math.abs(a.cPrice - a.tPrice));

  if (candidates.length === 0) {
    console.log("초안을 만들 새 가격비교 상품이 없습니다.");
    return;
  }

  mkdirSync(BLOG_DIR, { recursive: true });
  for (const { p, cPrice, tPrice } of candidates.slice(0, COUNT)) {
    const safe = p.title.split(",")[0].trim().replace(/[\\/:*?"<>|]/g, "").slice(0, 30);
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
