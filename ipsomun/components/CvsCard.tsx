import { brandName, coupangQuery, unitPrice, type CvsItem } from "@/lib/cvs";
import { won, imgUrl } from "@/lib/util";

/** 편의점 행사 상품 카드 — 서버에서 그린다. data-name 은 CvsSearch 가 거른다. */
export default function CvsCard({ it, showBrand = false }: { it: CvsItem; showBrand?: boolean }) {
  return (
    <article className="card cvs-card" data-name={it.n.toLowerCase()}>
      <span className={`badge cvs-deal d${it.t.replace("+", "p")}`}>{it.t}</span>
      <div className="thumb">
        {it.img ? (
          // 수천 장이라 최적화 서버 대신 프록시 썸네일 + 지연 로딩
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl(it.img, 240)} alt={it.n} loading="lazy" decoding="async" width={240} height={240} />
        ) : (
          <span className="noimg">🏪</span>
        )}
      </div>
      <div className="body">
        {showBrand && <div className={`cvs-brand b-${it.b}`}>{brandName(it.b)}</div>}
        <div className="title">{it.n}</div>
        <div className="price-row">
          <span className="price">{won(it.p)}</span>
        </div>
        {it.t !== "덤" && <div className="meta">1개당 {won(unitPrice(it))}</div>}
        <a
          className="cvs-cp"
          href={`/cvs/coupang?q=${encodeURIComponent(coupangQuery(it.n))}`}
          target="_blank"
          rel="nofollow sponsored noopener"
        >
          쿠팡 대용량 가격 ›
        </a>
      </div>
    </article>
  );
}
