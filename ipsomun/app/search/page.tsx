import { searchProductsDb } from "@/lib/db";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "검색" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q || "").trim();
  const items = query ? await searchProductsDb(query, 60) : [];

  return (
    <section className="section">
      <div className="section-head">
        <h2>&lsquo;{query}&rsquo; 검색 결과</h2>
        <span className="sub">{items.length}개</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">
          검색 결과가 없습니다. 다른 키워드로 검색해 보세요.
        </div>
      ) : (
        <div className="grid">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
