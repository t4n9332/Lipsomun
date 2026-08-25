import { getDeals } from "@/lib/db";
import ProductCard from "@/components/ProductCard";

export const revalidate = 300; // 오늘의 딜
export const metadata = { title: "오늘의 딜" };

export default async function DealsPage() {
  const deals = await getDeals(60);

  return (
    <section className="section">
      <div className="section-head">
        <h2>🔥 오늘의 딜</h2>
        <span className="sub">매일 갱신되는 특가 모음</span>
      </div>
      {deals.length === 0 ? (
        <div className="empty">아직 등록된 딜이 없습니다.</div>
      ) : (
        <div className="grid">
          {deals.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
