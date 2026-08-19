import { getByCategory } from "@/lib/db";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const category = decodeURIComponent(name);
  const items = await getByCategory(category, 60);

  return (
    <section className="section">
      <div className="section-head">
        <h2>{category}</h2>
        <span className="sub">{items.length}개 제품</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">이 카테고리에는 아직 제품이 없습니다.</div>
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
