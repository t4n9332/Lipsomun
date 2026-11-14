import Link from "next/link";
import { getPriceCompareProducts } from "@/lib/db";
import CompareCard, { comparePrices } from "@/components/CompareCard";
import { TELEGRAM_CHANNEL_URL, jsonLdString } from "@/lib/util";
import farm from "@/data/farm.json";
import FarmCard, { type FarmItem } from "@/components/FarmCard";
import { CROSS, CUR as CVS, HAS_DATA as CVS_READY } from "@/lib/cvsData";
import { brandName, monthLabel, unitPrice } from "@/lib/cvs";
import { won } from "@/lib/util";

export const revalidate = 300; // 홈 — 딜·가격 자주 변동

/**
 * 정규 주소. 텔레그램·푸시·공유 버튼이 매일 `?utm_source=…`가 붙은 링크를 뿌리는데,
 * canonical이 없으면 그 변종들이 저마다 다른 URL로 색인돼 색인이 희석된다.
 */
export const metadata = { alternates: { canonical: "/" } };

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

/**
 * 홈에만 두는 사이트 단위 구조화 데이터.
 * - WebSite + SearchAction: 구글 검색결과의 사이트링크 검색창 자격 요건.
 *   `{search_term_string}`은 리터럴이어야 하므로 URL 인코딩하지 않는다.
 * - Organization: 지식 패널·브랜드 인식용. 로고는 절대 URL이어야 한다.
 * 상품·기획전 페이지의 JSON-LD와 @type이 겹치지 않아 충돌하지 않는다.
 */
const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    url: `${SITE}/`,
    name: "입소문",
    alternateName: "입소문 — 쇼핑 가격비교·특가",
    description:
      "쿠팡·토스 가격비교, 편의점 행사, 생활 계산기와 오늘의 특가를 한곳에서.",
    inLanguage: "ko-KR",
    publisher: { "@id": `${SITE}/#org` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE}/#org`,
    name: "입소문",
    url: `${SITE}/`,
    logo: { "@type": "ImageObject", url: `${SITE}/icon-512.png`, width: 512, height: 512 },
    sameAs: [TELEGRAM_CHANNEL_URL],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "t4n2140@gmail.com",
      availableLanguage: ["ko"],
    },
  },
];

export default async function Home() {
  const compareRaw = await getPriceCompareProducts(40).catch(() => []);
  // 절약액(두 플랫폼 가격차) 큰 순으로 상단 노출
  const compare = compareRaw
    .sort((a, b) => comparePrices(b).savings - comparePrices(a).savings)
    .slice(0, 6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(siteJsonLd) }}
      />
      <section className="hero">
        <h1>
          사기 전에 한 번 더, <em>입소문</em>
        </h1>
        <p>
          쿠팡·토스 가격비교, 이번 달 편의점 행사, 내 월급 계산까지 — 사기 전에
          여기서 먼저 확인하세요.
        </p>
      </section>

      {/* 직접 만든 정보 콘텐츠를 상품 목록보다 먼저 — 사이트의 고유 가치가 첫 화면에 보이게 */}
      <section className="section">
        <div className="section-head">
          <h2>📌 생활 정보</h2>
          <Link className="more" href="/about">
            입소문 소개 →
          </Link>
        </div>
        <div className="home-info">
          {/* 편의점 섹션이 바로 아래 있으면 같은 칸을 두 번 보여주지 않는다 */}
          {CVS_READY && CROSS.length > 0 ? (
            <Link href="/tools">
              <strong>🧰 파일 도구</strong>
              <span>PDF 합치기 등, 업로드 없이</span>
            </Link>
          ) : (
            <Link href="/cvs">
              <strong>🏪 편의점 행사</strong>
              <span>4사 1+1·2+1, 버프·너프, 어디가 이득</span>
            </Link>
          )}
          <Link href="/calc/연봉실수령액">
            <strong>💰 연봉 실수령액</strong>
            <span>2026 4대보험 요율 반영</span>
          </Link>
          <Link href="/calc/연말정산환급금">
            <strong>🧧 연말정산 환급금</strong>
            <span>의료비·월세까지 미리 계산</span>
          </Link>
          <Link href="/calc/실업급여">
            <strong>🧾 실업급여</strong>
            <span>하루 얼마, 며칠 받나</span>
          </Link>
          <Link href="/calc/퇴직금">
            <strong>💼 퇴직금</strong>
            <span>퇴직소득세까지</span>
          </Link>
          <Link href="/calc/시급월급">
            <strong>⏱️ 시급·주휴수당</strong>
            <span>2026 최저임금 월급 계산</span>
          </Link>
        </div>
      </section>

      {CVS_READY && CROSS.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>🏪 {monthLabel(CVS.month)} 편의점, 여기서 사면 이득</h2>
            <Link className="more" href="/cvs/compare">
              전체 {CROSS.length}개 →
            </Link>
          </div>
          <ul className="cvs-cross">
            {CROSS.filter((x) => x.save > 0)
              .slice(0, 4)
              .map((x) => (
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

      {compare.length > 0 && (
        <section className="vs-section">
          <div className="section-head">
            <h2>🆚 쿠팡 vs 토스 가격비교</h2>
            <span className="sub">같은 상품, 어디가 더 쌀까? 매일 자동 비교</span>
            <Link className="more" href="/compare">
              전체보기 →
            </Link>
          </div>
          <div className="vs-grid">
            {compare.map((p) => (
              <CompareCard key={p.id} p={p} />
            ))}
          </div>
          <p className="vs-note">
            ※ 쿠폰 보유에 따라 가격 변동이 있습니다. 이 콘텐츠는 토스쇼핑
            쉐어링크 활동의 일환으로, 링크를 통한 구매가 발생하면 일정 수수료를
            지급받습니다.
          </p>
        </section>
      )}

      <a
        href={TELEGRAM_CHANNEL_URL}
        target="_blank"
        rel="noopener"
        className="tg-banner"
      >
        <span className="tg-icon">📣</span>
        <span className="tg-text">
          <b>매일 아침·저녁, 특가 브리핑을 텔레그램으로</b>
          <span>역대 최저가 · 쿠팡 vs 토스 가격차 TOP을 무료로 받아보세요</span>
        </span>
        <span className="tg-cta">무료 구독 →</span>
      </a>

      {farm.items.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>🥬 산지직송</h2>
            <span className="sub">입소문이 직접 운영하는 농수산물 스토어 · 산지에서 바로 발송</span>
            <Link className="more" href="/farm">
              전체보기 →
            </Link>
          </div>
          <div className="grid">
            {(farm.items as FarmItem[]).slice(0, 4).map((p) => (
              <FarmCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      {/* 2026-11-14 정리: 오늘의 딜·랭킹·기획전·최신 리뷰를 홈에 길게 늘어놓던 것을 바로가기로.
          휴대폰에서 홈이 10화면 넘게 길어져 정작 위쪽 고유 콘텐츠가 묻혔다. 각 페이지는 그대로다. */}
      <section className="section">
        <div className="section-head">
          <h2>더 둘러보기</h2>
        </div>
        <nav className="home-more" aria-label="더 둘러보기">
          <Link href="/deals">🔥 오늘의 딜</Link>
          <Link href="/ranking">🏆 인기 랭킹</Link>
          <Link href="/pick">🧺 기획전</Link>
          <Link href="/blog">📝 가격 리포트</Link>
          <Link href={`/category/${encodeURIComponent("식품")}`}>🍚 식품</Link>
          <Link href={`/category/${encodeURIComponent("생활용품")}`}>🧴 생활용품</Link>
        </nav>
      </section>
    </>
  );
}
