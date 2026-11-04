import type { Metadata } from "next";
import Link from "next/link";
import { BRANDS, brandName, monthLabel, unitPrice } from "@/lib/cvs";
import { CUR, PREV, HAS_DATA, HAS_PREV, CHANGES, CROSS, CATEGORY_COUNTS, bestSaving } from "@/lib/cvsData";
import CvsCard from "@/components/CvsCard";
import CvsSubscribe from "@/components/CvsSubscribe";
import type { CvsCategory } from "@/lib/cvs";
import CvsChangeRow from "@/components/CvsChangeRow";
import { won, jsonLdString } from "@/lib/util";

// 데이터는 매월 1일 커밋 → 재빌드로만 바뀐다
export const dynamic = "force-static";

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";
const M = HAS_DATA ? monthLabel(CUR.month) : "이번 달";

export const metadata: Metadata = {
  title: `${M} 편의점 행사 총정리 — GS25·CU·세븐일레븐·이마트24 1+1·2+1`,
  description: `${M} 편의점 4사 1+1·2+1 행사상품을 한곳에. 지난달보다 좋아진(버프)·나빠진(너프) 행사와, 같은 상품을 어디서 사야 1개당 가장 싼지 비교합니다. 매월 1일 갱신.`,
  alternates: { canonical: `${SITE}/cvs` },
  openGraph: {
    title: `${M} 편의점 행사 총정리 | 입소문`,
    url: `${SITE}/cvs`,
    type: "website",
    siteName: "입소문",
    locale: "ko_KR",
    images: ["/cvs/og"],
  },
};

export default function CvsHome() {
  const count = (b: string, t?: string) => CUR.items.filter((x) => x.b === b && (!t || x.t === t)).length;
  const buffs = CHANGES.filter((c) => c.kind === "buff").slice(0, 8);
  const nerfs = CHANGES.filter((c) => c.kind === "nerf").slice(0, 8);
  const cross = CROSS.slice(0, 12);

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "편의점 행사는 언제 바뀌나요?",
        acceptedAnswer: { "@type": "Answer", text: "GS25·CU·세븐일레븐·이마트24 모두 매월 1일에 행사상품이 바뀝니다. 입소문은 매월 1일 아침에 CU·세븐일레븐·이마트24의 공식 행사 목록을 모아 갱신합니다. GS25는 2026년부터 공식 홈페이지에서 행사 목록을 제공하지 않아 앱에서 확인해야 합니다." },
      },
      {
        "@type": "Question",
        name: "1+1과 2+1 중 어느 쪽이 더 싼가요?",
        acceptedAnswer: { "@type": "Answer", text: "1+1은 1개당 50% 할인, 2+1은 약 33% 할인입니다. 같은 가격이면 1+1이 1개당 더 쌉니다. 다만 편의점마다 정가가 달라 1개당 실제 가격으로 비교해야 정확합니다." },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faq) }} />
      <section className="hero cvs-hero">
        <h1>
          {M} <em>편의점 행사</em> 총정리
        </h1>
        <p>
          GS25·CU·세븐일레븐·이마트24의 1+1·2+1을 한곳에 모았습니다. 지난달보다 좋아진 <b>버프</b>와
          나빠진 <b>너프</b>, 같은 상품을 <b>어디서 사야 1개당 가장 싼지</b>까지 매월 1일 갱신합니다.
        </p>
        {HAS_DATA && (
          <div className="farm-sub">
            <span>총 {CUR.items.length.toLocaleString("ko-KR")}개 행사상품</span>
            <span>· {CUR.generated_at.slice(0, 10)} 기준</span>
          </div>
        )}
      </section>

      {!HAS_DATA ? (
        <div className="empty">매월 1일 아침에 4사 행사상품을 모아 올립니다. 첫 데이터를 준비 중이에요.</div>
      ) : (
        <>
          <section className="section">
            <div className="section-head">
              <h2>편의점별 행사</h2>
            </div>
            <div className="cvs-brands">
              {BRANDS.map((b) => (
                <Link key={b.id} href={`/cvs/${b.id}`} className={`cvs-brand-card b-${b.id}`}>
                  <strong>{b.name}</strong>
                  <span>
                    1+1 {count(b.id, "1+1")} · 2+1 {count(b.id, "2+1")}
                  </span>
                  <em>전체 {count(b.id)}개 →</em>
                  {CUR.stale?.includes(b.id) && <small>지난달 데이터 (갱신 지연)</small>}
                  {b.webless && count(b.id) === 0 && <small>공식 웹 목록 미제공 · 앱에서 확인</small>}
                </Link>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>분류별 1개당 최저가</h2>
              <span className="sub">편의점 구분 없이 같은 분류끼리</span>
            </div>
            <div className="cvs-cats">
              {CATEGORY_COUNTS.filter((x) => x.count > 0).map((x) => (
                <Link key={x.c} href={`/cvs/c/${encodeURIComponent(x.slug)}`}>
                  {x.c} <span>{x.count}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>💰 분류별 꿀템</h2>
              <span className="sub">1개당 가장 많이 아끼는 1+1·2+1</span>
            </div>
            <div className="grid cvs-grid">
              {(["음료", "과자·간식", "간편식", "아이스크림", "생활용품", "주류"] as CvsCategory[]).flatMap((c) =>
                bestSaving(c).map((it) => <CvsCard key={c} it={it} showBrand />)
              )}
            </div>
          </section>

          {HAS_PREV && (
            <section className="section">
              <div className="section-head">
                <h2>
                  🎮 {monthLabel(PREV.month)} → {M} 패치노트
                </h2>
                <Link className="more" href="/cvs/patch">
                  전체 보기 →
                </Link>
              </div>
              <div className="cvs-patch-cols">
                <div>
                  <h3 className="cvs-buff-h">▲ 버프 TOP</h3>
                  <ul className="cvs-changes">{buffs.map((c, i) => <CvsChangeRow key={i} c={c} />)}</ul>
                </div>
                <div>
                  <h3 className="cvs-nerf-h">▼ 너프 TOP</h3>
                  <ul className="cvs-changes">{nerfs.map((c, i) => <CvsChangeRow key={i} c={c} />)}</ul>
                </div>
              </div>
            </section>
          )}

          {cross.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>🆚 같은 상품, 어디가 이득?</h2>
                <Link className="more" href="/cvs/compare">
                  전체 {CROSS.length}개 →
                </Link>
              </div>
              <ul className="cvs-cross">
                {cross.map((x) => (
                  <li key={x.name}>
                    <div className="nm">{x.name}</div>
                    <div className="offers">
                      {x.offers.map((o, i) => (
                        <span key={o.b} className={`cvs-offer b-${o.b}${i === 0 ? " win" : ""}`}>
                          {brandName(o.b)} <b>{o.t}</b> {won(unitPrice(o))}
                        </span>
                      ))}
                    </div>
                    <div className="save">1개당 {won(x.save)} 이득</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <CvsSubscribe place="hub" />

      <p className="vs-note">
        ※ 각 편의점 공식 홈페이지의 행사 안내를 모아 정리한 정보입니다. 매장·지역에 따라 행사 여부와 가격이 다를 수
        있고, 1개당 가격은 표시 가격 기준 계산값입니다.
      </p>
    </>
  );
}
