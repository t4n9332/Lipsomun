import type { Metadata } from "next";
import Link from "next/link";
import farm from "@/data/farm.json";
import { getGiftSetProducts, withLinks } from "@/lib/db";
import { farmGiftItems } from "@/lib/farm-match";
import { jsonLdString } from "@/lib/util";
import FarmCard, { type FarmItem } from "@/components/FarmCard";
import ProductCard from "@/components/ProductCard";

/**
 * 설 선물세트 페이지 (2026-11-24 작성, 2027 설 대비).
 * 1월 내내 '설 선물세트' 검색이 몰린다 — 색인될 시간을 벌려고 미리 연다.
 * ① 산지직송(운영자 직판 — 마진이 가장 크다) 명절 선물을 예산별로, ② 제목에 선물 표시가 있는 제휴 상품(자동).
 * ⚠️ 해마다 SEOL 날짜와 본문 연도를 갱신할 것. 날짜 근거: 우주항공청 2027 월력요항(설 2/7, 연휴 2/6~2/9).
 */
export const revalidate = 1800;

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";
const SEOL = { year: 2027, date: "2월 7일(일)", holiday: "2월 6일(토)~9일(화)", giftPeriod: "1월 14일~2월 12일" };

export const metadata: Metadata = {
  title: `${SEOL.year} 설 선물세트 추천 — 예산별 한우·굴비·과일·곶감`,
  description: `${SEOL.year} 설날(${SEOL.date}) 선물세트를 예산별로 골랐습니다. 산지직송 한우·영광굴비·과일·곶감 선물과 가공식품 세트, 택배 마감·청탁금지법 선물 한도까지 한 번에 확인하세요.`,
  alternates: { canonical: `${SITE}/seollal` },
  openGraph: {
    title: `${SEOL.year} 설 선물세트 추천 | 입소문`,
    url: `${SITE}/seollal`,
    type: "website",
    siteName: "입소문",
    locale: "ko_KR",
    images: ["/og-default.png"],
  },
};

const BUDGETS: { label: string; note: string; min: number; max: number }[] = [
  { label: "5만원 이하", note: "부담 없이 돌리기 좋은 정성 선물", min: 0, max: 50_000 },
  { label: "5만~10만원", note: "부모님·가까운 친척께", min: 50_000, max: 100_000 },
  { label: "10만원 이상", note: "격식을 갖춘 명절 선물", min: 100_000, max: Infinity },
];

export default async function SeollalPage() {
  const gifts = farmGiftItems(farm.items as FarmItem[]);
  const partner = await withLinks(await getGiftSetProducts(24)).catch(() => []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SEOL.year} 설 선물세트 추천`,
    itemListElement: partner.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.title,
      url: `${SITE}/p/${encodeURIComponent(p.slug)}`,
    })),
  };

  return (
    <>
      {partner.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      )}
      <section className="hero seol-hero">
        <h1>
          {SEOL.year} <em>설 선물세트</em>, 예산별로 골라 보기
        </h1>
        <p>
          {SEOL.year}년 설날은 <b>{SEOL.date}</b>, 연휴는 {SEOL.holiday}입니다. 명절 직전에는 택배가 몰려
          배송이 늦어지기 쉬우니 선물은 조금 일찍 준비하는 편이 안전합니다.
        </p>
      </section>

      <section className="section seol-tips">
        <div className="section-head">
          <h2>보내기 전에 확인할 3가지</h2>
        </div>
        <ul>
          <li>
            <b>택배 마감:</b> 설 직전 1~2주는 물량이 몰려 택배사·판매처마다 명절 전 접수 마감일을 따로 공지합니다.
            특히 신선식품(한우·굴비·과일)은 받는 날짜가 중요하니 판매처 공지의 마지막 발송일을 꼭 확인하세요.
          </li>
          <li>
            <b>청탁금지법 선물 한도:</b> 공직자 등에게 주는 농수산물·농수산가공품 선물은 평소 15만 원,
            설·추석 기간(명절 전 24일~후 5일)에는 30만 원까지입니다. {SEOL.year}년 설 기준으로 계산하면{" "}
            {SEOL.giftPeriod}이며, 그 외 일반 선물은 5만 원, 금액이 적힌 상품권은 허용되지 않습니다.
            정확한 기간은 국민권익위원회 공지를 확인하세요.
          </li>
          <li>
            <b>받는 사람 일정:</b> 신선식품은 부재 중 문 앞에 오래 두면 상할 수 있습니다. 받는 분이 집에 있는 날인지,
            명절에 고향에 내려가 집이 비지는 않는지 미리 물어보면 실패가 없습니다.
          </li>
        </ul>
      </section>

      {gifts.length > 0 && (
        <section className="section farm-xsell">
          <div className="section-head">
            <h2>🌾 산지직송 명절 선물</h2>
            <Link href="/farm" className="more">
              산지직송 전체 보기 →
            </Link>
          </div>
          <p className="farm-xsell-sub">
            입소문이 직접 운영하는 스토어예요. 산지에서 바로 보내 드리며, 결제는 네이버 스마트스토어에서 합니다.
          </p>
          {BUDGETS.map((b) => {
            const list = gifts.filter((g) => g.price_from >= b.min && g.price_from < b.max);
            if (!list.length) return null;
            return (
              <div key={b.label} className="seol-budget">
                <h3>
                  {b.label} <span>{b.note}</span>
                </h3>
                <div className="grid">
                  {list.map((p) => (
                    <FarmCard key={p.id} p={p as FarmItem} from="seol" />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {partner.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>🎁 가공식품·생활 선물세트</h2>
            <span className="sub">스팸·참치·조미료·홍삼 등 오래 두고 쓰는 선물</span>
          </div>
          <div className="grid">
            {partner.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      <p className="vs-note">
        ※ 산지직송 상품은 입소문 운영자가 직접 판매하는 상품이고, 가공식품·생활 선물세트는 쿠팡 파트너스·토스쇼핑
        활동의 일환으로 일정 수수료를 받을 수 있습니다. 가격·재고·배송 마감은 판매처 기준이며 바뀔 수 있습니다.
      </p>
    </>
  );
}
