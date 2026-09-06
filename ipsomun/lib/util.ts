export const PLATFORMS: { key: string; name: string; color: string }[] = [
  { key: "coupang", name: "쿠팡", color: "#c9302c" },
  { key: "naver", name: "네이버", color: "#03c75a" },
  { key: "toss", name: "토스쇼핑", color: "#3182f6" },
  { key: "11st", name: "11번가", color: "#ff0038" },
  { key: "ohouse", name: "오늘의집", color: "#35c5f0" },
  { key: "gmarket", name: "G마켓", color: "#00c73c" },
  { key: "auction", name: "옥션", color: "#e60012" },
  { key: "ssg", name: "SSG", color: "#111111" },
  { key: "lotteon", name: "롯데온", color: "#da291c" },
  { key: "wemakeprice", name: "위메프", color: "#d61e30" },
  { key: "tmon", name: "티몬", color: "#f26c25" },
  { key: "musinsa", name: "무신사", color: "#111111" },
  { key: "oliveyoung", name: "올리브영", color: "#9bce26" },
  { key: "etc", name: "기타", color: "#6b7280" },
];

export function platformName(key: string): string {
  return PLATFORMS.find((p) => p.key === key)?.name ?? key;
}

export function platformColor(key: string): string {
  return PLATFORMS.find((p) => p.key === key)?.color ?? "#6b7280";
}

/** 텔레그램 특가 알림 채널 */
export const TELEGRAM_CHANNEL_URL = "https://t.me/cheapicker";

export const CATEGORIES = [
  "가전/디지털",
  "생활용품",
  "주방용품",
  "식품",
  "뷰티",
  "패션",
  "홈인테리어",
  "스포츠/레저",
  "육아",
  "반려동물",
  "기타",
];

export function won(n: number | null | undefined): string {
  if (n == null) return "";
  return n.toLocaleString("ko-KR") + "원";
}

export function discountRate(price?: number | null, original?: number | null): number | null {
  if (!price || !original || original <= price) return null;
  return Math.round(((original - price) / original) * 100);
}

/**
 * 상품 이미지를 리사이즈 프록시(wsrv.nl)를 거쳐 내보낸다.
 *
 * 배경: Vercel 이미지 최적화는 월 할당량이 있어 소진되면 /_next/image가 402를
 * 반환하고 사이트 전체 이미지가 깨진다(2026-08-26 실제 발생). 그래서 Next의
 * 최적화는 끄고(next.config: unoptimized), 대신 무료 프록시로 줄인다.
 * 쿠팡 원본은 1MB에 육박하는 것도 있어(표본 평균 288KB) 모바일에서 부담이 크다.
 * 실측: 984KB → 28KB(98% 감소), 프록시 캐시 적중 시 0.17초.
 *
 * 프록시가 죽으면 이미지가 안 나오므로, 되돌리려면 NEXT_PUBLIC_IMG_PROXY=off로
 * 환경변수만 바꾸면 원본 URL을 그대로 쓴다.
 */
export function imgUrl(src: string | null | undefined, width = 480): string {
  if (!src) return "";
  if (process.env.NEXT_PUBLIC_IMG_PROXY === "off") return src;
  // data:·상대경로·자체 호스트 자산은 그대로 둔다
  if (!/^https?:\/\//i.test(src)) return src;
  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=${width}&output=webp&q=80&we`;
}

/* ---------- 수수료율 · 구매 버튼 우선순위 ---------- */

/**
 * 플랫폼별 대략적인 수수료율. 토스 10%는 프로모션(TOSS_PROMO_END까지)이고
 * 그 뒤에는 쿠팡보다 낮아질 수 있어 날짜로 분기한다.
 * 토스 정책 리스크가 현실화되면 toss를 0으로 두면 토스 버튼이 항상 2순위가 된다.
 */
export const PLATFORM_RATE: Record<string, number> = { coupang: 0.03, toss: 0.1 };
export const TOSS_PROMO_END = "2026-09-25";
export const TOSS_RATE_AFTER_PROMO = 0.02;

export function rateOf(platform: string, at: Date = new Date()): number {
  if (platform === "toss") {
    const kst = new Date(at.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    return kst > TOSS_PROMO_END ? TOSS_RATE_AFTER_PROMO : PLATFORM_RATE.toss;
  }
  return PLATFORM_RATE[platform] ?? 0;
}

export interface PricedLink {
  id: string;
  platform: string;
  price: number | null;
}

/** 링크의 실효 가격 — 쿠팡 링크에 개별 가격이 없으면 상품 가격(쿠팡에서 가져온 값) */
export function effLinkPrice(l: PricedLink, productPrice: number | null | undefined): number | null {
  return l.price ?? (l.platform === "coupang" ? (productPrice ?? null) : null);
}

/**
 * 구매 버튼 우선순위를 한 곳에서 결정한다 (상세·카드·알림이 모두 이 규칙을 쓴다).
 *  1) 가격이 싼 쪽 먼저
 *  2) 가격이 같거나 1% 이내면 수수료율이 높은 쪽 먼저
 *  3) 가격 정보가 없는 링크는 뒤로 (쿠팡·토스 → 나머지)
 * lowest는 가격을 아는 링크가 2개 이상일 때만 (칩은 '엄격히 더 싼 쪽'에만 붙는다).
 */
export function pickPrimary<L extends PricedLink>(
  links: L[],
  productPrice: number | null | undefined,
  at: Date = new Date()
): { ordered: L[]; primary: L | null; lowest: number | null; priceOf: (l: L) => number | null } {
  const priceOf = (l: L) => effLinkPrice(l, productPrice);
  const priced = links.map(priceOf).filter((p): p is number => p != null);
  const lowest = priced.length >= 2 ? Math.min(...priced) : null;
  const base = (l: L) => (l.platform === "coupang" || l.platform === "toss" ? 0 : 1);
  const ordered = [...links].sort((a, b) => {
    if (base(a) !== base(b)) return base(a) - base(b);
    const pa = priceOf(a);
    const pb = priceOf(b);
    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;
    const near = Math.abs(pa - pb) <= Math.min(pa, pb) * 0.01;
    if (!near) return pa - pb;
    return rateOf(b.platform, at) - rateOf(a.platform, at);
  });
  return { ordered, primary: ordered[0] ?? null, lowest, priceOf };
}

/* ---------- 채널 측정 ---------- */

/**
 * 외부 채널(텔레그램·스레드·네이버·푸시)로 내보내는 링크에 UTM을 붙인다.
 * GA4가 자동 집계하고, ViewTracker가 utm_source를 쿠키로 남겨 /go 클릭까지 출처를 잇는다.
 * ISR 페이지는 searchParams를 읽지 않으므로 캐시에 영향이 없다.
 */
export function withUtm(url: string, source: string, medium = "social", campaign?: string): string {
  const u = new URL(url, "https://lipsomun.co.kr");
  u.searchParams.set("utm_source", source);
  u.searchParams.set("utm_medium", medium);
  if (campaign) u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}

/**
 * JSON-LD를 <script>에 넣을 때 쓴다. JSON.stringify는 '<'를 이스케이프하지 않아
 * 외부에서 받아온 상품명·리뷰에 '</script>'가 들어오면 스크립트가 닫혀버린다(저장형 XSS).
 * 유니코드 이스케이프는 JSON 의미가 같으므로 구글 리치결과에 영향이 없다.
 */
export function jsonLdString(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "product";
}
