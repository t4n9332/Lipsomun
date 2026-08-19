import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { CATEGORIES } from "@/lib/util";

export const metadata: Metadata = {
  title: {
    default: "입소문 — 진짜 써본 사람들의 쇼핑 추천",
    template: "%s | 입소문",
  },
  description:
    "오늘의 특가부터 카테고리별 인기 랭킹, 솔직 리뷰까지. 입소문에서 확인하고 최저가로 구매하세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* Google Analytics (GA4) */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-21K65KFJ2J"
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-21K65KFJ2J');`,
          }}
        />
      </head>
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="logo">
              입<span>소문</span>
            </Link>
            <form className="search-form" action="/search">
              <input name="q" placeholder="어떤 제품이 궁금하세요?" />
              <button type="submit" aria-label="검색">⌕</button>
            </form>
            <nav className="header-links">
              <Link href="/deals">오늘의 딜</Link>
              <Link href="/ranking">랭킹</Link>
              <Link href="/favorites">찜 ♥</Link>
            </nav>
          </div>
          <div className="container">
            <nav className="cat-nav">
              {CATEGORIES.map((c) => (
                <Link key={c} href={`/category/${encodeURIComponent(c)}`}>
                  {c}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="container">{children}</main>

        <footer className="site-footer">
          <div className="container">
            <div className="logo">
              입<span>소문</span>
            </div>
            <p>
              입소문은 여러 쇼핑 플랫폼의 제품을 비교·추천하는 큐레이션
              서비스입니다.
              <br />
              이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
              수수료를 제공받습니다. 또한 네이버, 11번가, 토스쇼핑, 오늘의집 등
              제휴 링크를 통한 구매 시 수수료를 받을 수 있습니다. 구매자에게
              추가 비용은 발생하지 않습니다.
            </p>
            <p>© {new Date().getFullYear()} 입소문</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
