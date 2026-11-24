import Link from "next/link";
import farm from "@/data/farm.json";
import FarmCard, { type FarmItem } from "@/components/FarmCard";
import { farmPicksFor, farmSeasonal } from "@/lib/farm-match";

/**
 * 제휴 상품 상세 → 산지직송(운영자 직판) 교차 노출. 서버 컴포넌트라 farm.json 은 브라우저로 가지 않는다.
 * 매칭 규칙은 lib/farm-match.ts — 맞는 상품이 없으면 아무것도 그리지 않는다.
 */
export function FarmCrossSell({ product }: { product: { title: string; category: string } }) {
  const picks = farmPicksFor(product, farm.items as FarmItem[], { limit: 3 });
  if (!picks.items.length) return null;
  const tab = picks.category ? `/farm#${encodeURIComponent(picks.category)}` : "/farm";
  return (
    <section className="section farm-xsell" aria-label="산지직송 추천">
      <div className="section-head">
        <h2>🌾 산지직송으로도 만나보세요</h2>
        <Link href={tab} className="more">
          산지직송 전체 보기 →
        </Link>
      </div>
      <p className="farm-xsell-sub">
        입소문이 직접 운영하는 스토어예요. 주문이 들어오면 산지에서 바로 보내드립니다.
        {picks.keyword ? ` ‘${picks.keyword}’ 관련 상품을 골랐어요.` : " 이 시기에 맛있는 상품을 골랐어요."}
      </p>
      <div className="grid">
        {picks.items.map((p) => (
          <FarmCard key={p.id} p={p as FarmItem} from="xsell" />
        ))}
      </div>
    </section>
  );
}

/** 식품 카테고리 상단 — 이번 달 제철 산지직송 */
export function FarmSeasonalStrip() {
  const items = farmSeasonal(farm.items as FarmItem[], { limit: 4 });
  if (!items.length) return null;
  const month = new Date(Date.now() + 9 * 3600 * 1000).getUTCMonth() + 1;
  return (
    <section className="section farm-xsell" aria-label="제철 산지직송">
      <div className="section-head">
        <h2>🌾 {month}월 제철 산지직송</h2>
        <Link href="/farm" className="more">
          산지직송 전체 보기 →
        </Link>
      </div>
      <p className="farm-xsell-sub">입소문이 직접 운영하는 스토어 · 산지에서 바로 발송</p>
      <div className="grid">
        {items.map((p) => (
          <FarmCard key={p.id} p={p as FarmItem} from="cat" />
        ))}
      </div>
    </section>
  );
}
