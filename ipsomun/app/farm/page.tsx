import type { Metadata } from "next";
import farm from "@/data/farm.json";
import { type FarmItem } from "@/components/FarmCard";
import FarmTabs from "@/components/FarmTabs";

// 산지직송 코너 — 입소문 운영자가 직접 파는 농수산물 (제휴 링크 아님).
//
// 데이터는 다른 프로젝트(witak-auto)의 `python run.py farm-export --push` 가
// data/farm.json 을 갈아끼우고 푸시하면 Vercel 이 다시 빌드한다. 매일 17:10 자동.
// 이 페이지는 그 JSON 을 읽어 그리기만 한다 — DB 도, 관리자 화면도 쓰지 않는다.
// 분류는 가로 탭(FarmTabs)으로 나눈다 — 상품이 늘어도 세로 스크롤이 길어지지 않게.
export const dynamic = "force-static";

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";
// farm.json 의 category 값과 같아야 한다(witak-auto core/farmexport.py 의 _RULES). 없는 분류는 표시되지 않는다.
const ORDER = ["과일", "채소", "수산물", "축산물", "건어물", "김치·반찬", "밀키트", "기타"];

export const metadata: Metadata = {
  title: "산지직송 농수산물",
  description:
    "입소문이 직접 운영하는 산지직송 스토어. 과일·채소·수산물·축산물·김치를 산지에서 바로 보내드립니다.",
  alternates: { canonical: `${SITE}/farm` },
  openGraph: {
    title: "산지직송 농수산물 | 입소문",
    url: `${SITE}/farm`,
    type: "website",
    siteName: "입소문",
  },
};

export default function FarmPage() {
  const items = farm.items as FarmItem[];
  const groups = ORDER.map((c) => [c, items.filter((i) => i.category === c)] as [string, FarmItem[]]).filter(
    ([, v]) => v.length > 0
  );
  const updated = (farm.generated_at || "").replace("T", " ").slice(0, 16);

  return (
    <>
      <section className="hero farm-hero">
        <h1>
          산지에서 바로, <em>산지직송</em>
        </h1>
        <p>
          입소문이 직접 운영하는 농수산물 스토어입니다. 주문이 들어오면 그날 산지에 발주해
          산지에서 바로 보내드립니다. 결제는 네이버 스마트스토어에서 이뤄집니다.
        </p>
        <div className="farm-sub">
          <span>총 {items.length}개 상품</span>
          {updated && <span>· {updated} 기준</span>}
          {farm.store?.naver_url && (
            <a href={farm.store.naver_url} target="_blank" rel="noopener">
              스토어 전체보기 →
            </a>
          )}
        </div>
      </section>

      {groups.length === 0 ? (
        <div className="empty">지금은 판매 중인 상품이 없습니다. 곧 다시 채워 넣을게요.</div>
      ) : (
        <FarmTabs groups={groups} />
      )}

      <p className="vs-note">
        ※ 이 코너의 상품은 제휴 링크가 아니라 입소문 운영자(스토어 &lsquo;{farm.store?.name || "백납"}&rsquo;)가
        직접 판매하는 상품입니다. 가격·재고는 네이버 스토어 기준이며, 표시 시각 이후 바뀔 수 있습니다.
        신선식품 특성상 단순변심 반품이 제한될 수 있습니다.
      </p>
    </>
  );
}
