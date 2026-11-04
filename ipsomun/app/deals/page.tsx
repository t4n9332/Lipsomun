import { getDeals, withLinks } from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import ListInsight from "@/components/ListInsight";
import PushSubscribeButton from "@/components/PushSubscribeButton";

export const revalidate = 300; // 오늘의 딜
export const metadata = { title: "오늘의 딜", alternates: { canonical: "/deals" } };

export default async function DealsPage() {
  const deals = await withLinks(await getDeals(60));

  return (
    <section className="section">
      <div className="section-head">
        <h1>🔥 오늘의 딜</h1>
        <span className="sub">매일 갱신되는 특가 모음</span>
      </div>
      <ListInsight items={deals} label="오늘의 딜" />
      <PushSubscribeButton hint="로그인 없이, 브라우저 알림으로 매일 아침 7시" />
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
