import { getPopular, withLinks } from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import ListInsight from "@/components/ListInsight";

export const revalidate = 600; // 랭킹
export const metadata = { title: "인기 랭킹", alternates: { canonical: "/ranking" } };

export default async function RankingPage() {
  const items = await withLinks(await getPopular(30));

  return (
    <section className="section">
      <div className="section-head">
        <h1>🏆 인기 랭킹 TOP {items.length || 30}</h1>
        <span className="sub">방문자 조회·클릭 기준</span>
      </div>
      <ListInsight items={items} label="인기 랭킹 상품" />
      {items.length === 0 ? (
        <div className="empty">데이터가 쌓이는 중입니다.</div>
      ) : (
        <div className="grid">
          {items.map((p, i) => (
            <ProductCard key={p.id} p={p} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
