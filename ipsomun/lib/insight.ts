/**
 * 상품 목록 요약 문장 — 카테고리·딜·랭킹 페이지 위에 붙는다.
 *
 * 상품 카드만 나열된 페이지는 검색엔진·애드센스가 '남의 상품을 다시 보여주는 얇은 페이지'로 본다.
 * 그 목록의 실제 숫자(가격대·할인율·쿠팡 vs 토스 어디가 싼지·가장 많이 본 상품)를 문장으로 풀어
 * 페이지마다 다르고, 매일 바뀌는 고유 정보를 만든다. 순수 함수라 테스트할 수 있다.
 */

export interface InsightItem {
  title: string;
  price: number | null;
  originalPrice: number | null;
  views: number;
  clicks: number;
  links: { platform: string; price: number | null }[];
}

const won = (n: number) => Math.round(n).toLocaleString("ko-KR") + "원";

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function listInsight(items: InsightItem[], label: string): string[] {
  if (items.length < 3) return [];
  const out: string[] = [];

  const prices = items.map((p) => p.price).filter((x): x is number => x != null && x > 0);
  if (prices.length >= 3) {
    out.push(
      `${label} ${items.length}개의 가격대는 ${won(Math.min(...prices))}~${won(Math.max(...prices))}, ` +
        `가운데 값은 ${won(median(prices))}입니다.`
    );
  }

  const disc = items
    .filter((p) => p.price && p.originalPrice && p.originalPrice > p.price)
    .map((p) => (p.originalPrice! - p.price!) / p.originalPrice!);
  if (disc.length >= 2) {
    out.push(
      `정가보다 싸게 파는 상품이 ${disc.length}개이고, 평균 할인율은 ${Math.round(
        (disc.reduce((a, b) => a + b, 0) / disc.length) * 100
      )}%(최대 ${Math.round(Math.max(...disc) * 100)}%)입니다.`
    );
  }

  // 쿠팡·토스 둘 다 가격이 있는 상품끼리 어디가 더 싼지
  let tossCheaper = 0;
  let coupangCheaper = 0;
  for (const p of items) {
    const c = p.links.find((l) => l.platform === "coupang");
    const t = p.links.find((l) => l.platform === "toss");
    const cp = c ? (c.price ?? p.price) : null;
    const tp = t?.price ?? null;
    if (cp && tp) {
      if (tp < cp) tossCheaper++;
      else if (cp < tp) coupangCheaper++;
    }
  }
  if (tossCheaper + coupangCheaper >= 2) {
    out.push(
      `쿠팡과 토스쇼핑 가격을 함께 비교할 수 있는 ${tossCheaper + coupangCheaper}개 중 ` +
        `토스가 더 싼 상품이 ${tossCheaper}개, 쿠팡이 더 싼 상품이 ${coupangCheaper}개입니다.`
    );
  }

  const top = [...items].sort((a, b) => b.views + b.clicks * 5 - (a.views + a.clicks * 5))[0];
  if (top && top.views + top.clicks > 0) {
    out.push(`방문자가 가장 많이 본 상품은 '${top.title.slice(0, 40)}'입니다.`);
  }
  return out;
}
