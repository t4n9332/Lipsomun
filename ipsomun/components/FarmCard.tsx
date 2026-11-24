import Image from "next/image";
import { won, imgUrl } from "@/lib/util";

/**
 * 산지직송 코너 카드 — data/farm.json 의 항목 하나.
 *
 * 이 코너는 제휴 링크가 아니라 입소문 운영자가 직접 파는 상품이다(스토어 '백납').
 * 데이터는 `witak-auto` 프로젝트의 `farm-export` 가 만들어 넣는다 — 손으로 고치지 말 것.
 */
export interface FarmOption {
  name: string;
  price: number;
  soldout: boolean;
}

export interface FarmItem {
  id: string;
  group_id: string;
  title: string;
  category: string;
  image: string;
  price_from: number;
  options: FarmOption[];
  naver_url: string;
  coupang_url: string;
  season_kind: string;
  peak_months: number[];
  created_at: string;
}

/**
 * @param from 어디에 놓인 카드인지 — 네이버 스토어 이동을 /farm/go 경유로 집계한다(관리자 '클릭 위치').
 *   farm(산지직송 코너) · xsell(제휴 상품 상세의 교차 노출) · cat(카테고리 배너) · seol(설 선물 페이지)
 */
export default function FarmCard({ p, from = "farm" }: { p: FarmItem; from?: "farm" | "xsell" | "cat" | "seol" }) {
  const naver = p.naver_url ? `/farm/go/${encodeURIComponent(p.id)}?from=${from}` : "";
  const buy = naver || p.coupang_url;
  return (
    <article className="card farm-card">
      {p.category && <span className="badge farm">{p.category}</span>}
      <a href={buy} target="_blank" rel="nofollow noopener" className="thumb">
        {p.image ? (
          <Image
            src={imgUrl(p.image, 400)}
            alt={p.title}
            fill
            sizes="(max-width: 640px) 50vw, 220px"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <span className="noimg">🥬</span>
        )}
      </a>
      <div className="body">
        <div className="title">{p.title}</div>
        <ul className="farm-opts">
          {p.options.map((o) => (
            <li key={o.name || "single"} className={o.soldout ? "soldout" : ""}>
              <span>{o.name || "단품"}</span>
              <b>{won(o.price)}</b>
              {o.soldout && <em>품절</em>}
            </li>
          ))}
        </ul>
        <div className="price-row">
          <span className="price">{won(p.price_from)}</span>
          <span className="meta">부터</span>
        </div>
        <div className="farm-btns">
          {p.naver_url && (
            <a className="btn farm-naver" href={naver} target="_blank" rel="nofollow noopener">
              네이버 스토어에서 구매
            </a>
          )}
          {p.coupang_url && (
            <a className="btn secondary sm" href={p.coupang_url} target="_blank" rel="noopener">
              쿠팡에서 보기
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
