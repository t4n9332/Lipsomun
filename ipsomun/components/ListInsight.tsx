import { listInsight, type InsightItem } from "@/lib/insight";

/** 상품 목록 위 요약 문단 — 목록의 실제 숫자로 만든 고유 문장 (lib/insight.ts) */
export default function ListInsight({ items, label }: { items: InsightItem[]; label: string }) {
  const lines = listInsight(items, label);
  if (!lines.length) return null;
  return <p className="list-insight">{lines.join(" ")}</p>;
}
