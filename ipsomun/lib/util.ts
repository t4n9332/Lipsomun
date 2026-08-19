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

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "product";
}
