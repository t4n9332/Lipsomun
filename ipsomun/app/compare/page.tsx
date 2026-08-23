import { getPriceCompareProducts } from "@/lib/db";
import CompareCard, { comparePrices } from "@/components/CompareCard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "쿠팡 vs 토스 가격비교",
  description:
    "같은 상품의 쿠팡·토스쇼핑 가격을 나란히 비교하고 더 싼 곳에서 구매하세요.",
};

export default async function ComparePage() {
  const items = (await getPriceCompareProducts(200)).sort(
    (a, b) => comparePrices(b).savings - comparePrices(a).savings
  );

  return (
    <section className="section">
      <div className="section-head">
        <h2>🆚 쿠팡 vs 토스 가격비교</h2>
        <span className="sub">
          같은 상품 {items.length}개 — 절약액이 큰 순서로 보여드려요
        </span>
      </div>
      {items.length === 0 ? (
        <div className="empty">비교 가능한 상품을 모으는 중입니다.</div>
      ) : (
        <div className="vs-grid">
          {items.map((p) => (
            <CompareCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
