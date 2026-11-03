import type { Metadata } from "next";
import Link from "next/link";
import { brandName, coupangQuery, monthLabel, unitPrice } from "@/lib/cvs";
import { CUR, HAS_DATA, CROSS } from "@/lib/cvsData";
import CvsSearch from "@/components/CvsSearch";
import CvsSubscribe from "@/components/CvsSubscribe";
import { won } from "@/lib/util";

/**
 * 같은 상품을 두 곳 이상에서 행사할 때 — 어느 편의점이 1개당 가장 싼가. 전체 목록.
 * 다른 사이트에 없는 비교라 이 사이트의 고유 콘텐츠다.
 */
export const dynamic = "force-static";

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";
const M = HAS_DATA ? monthLabel(CUR.month) : "이번 달";

export const metadata: Metadata = {
  title: `${M} 같은 상품 편의점별 행사 비교 — 어디서 사야 1개당 가장 쌀까`,
  description: `${M} CU·세븐일레븐·이마트24에서 동시에 행사하는 같은 상품 ${CROSS.length}개를 1개당 실제 가격으로 비교했습니다. 1+1과 2+1이 엇갈리는 상품을 한눈에.`,
  alternates: { canonical: `${SITE}/cvs/compare` },
  openGraph: { title: `${M} 편의점 행사 비교 | 입소문`, url: `${SITE}/cvs/compare`, type: "article", siteName: "입소문", locale: "ko_KR", images: ["/og-default.png"] },
};

export default function CvsComparePage() {
  return (
    <section className="section">
      <div className="section-head">
        <h1>🆚 {M} 같은 상품, 어디가 이득?</h1>
        <span className="sub">{CROSS.length}개 · 1개당 차이 큰 순</span>
      </div>
      <p className="cvs-patch-lead">
        같은 상품이라도 한 편의점은 1+1, 다른 곳은 2+1인 경우가 많습니다. 두 곳 이상에서 행사하는 상품을 모아
        행사대로 샀을 때의 <b>1개당 가격</b>으로 비교했습니다. 맨 앞(색이 채워진 칸)이 가장 싼 곳입니다.{" "}
        <Link href="/cvs">← 편의점 행사 전체</Link>
      </p>
      {CROSS.length === 0 ? (
        <div className="empty">매월 1일 행사가 갱신되면 비교가 채워집니다.</div>
      ) : (
        <div id="cvs-cmp">
          <CvsSearch target="cvs-cmp" placeholder="상품 이름으로 찾기 (예: 닭가슴살, 컵라면)" />
          <ul className="cvs-cross">
            {CROSS.map((x) => (
              <li key={x.name} data-name={x.name.toLowerCase()}>
                <div className="nm">{x.name}</div>
                <div className="offers">
                  {x.offers.map((o, i) => (
                    <span key={o.b} className={`cvs-offer b-${o.b}${i === 0 ? " win" : ""}`}>
                      {brandName(o.b)} <b>{o.t}</b> {won(unitPrice(o))}
                    </span>
                  ))}
                </div>
                <a
                  className="cvs-cp"
                  href={`/cvs/coupang?q=${encodeURIComponent(coupangQuery(x.name))}`}
                  target="_blank"
                  rel="nofollow sponsored noopener"
                >
                  쿠팡에서 박스로 사면? ›
                </a>
                {x.save > 0 ? (
                  <div className="save">1개당 {won(x.save)} 이득</div>
                ) : (
                  <div className="save same">어디서 사도 같음</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <CvsSubscribe place="compare" />
    </section>
  );
}
