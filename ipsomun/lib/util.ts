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

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "product";
}
