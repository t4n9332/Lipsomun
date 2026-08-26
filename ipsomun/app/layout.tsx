import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { CATEGORIES, TELEGRAM_CHANNEL_URL } from "@/lib/util";
import UserMenu from "@/components/UserMenu";
import SearchBar from "@/components/SearchBar";
import InstallPrompt from "@/components/InstallPrompt";

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "입소문 — 진짜 써본 사람들의 쇼핑 추천",
    template: "%s | 입소문",
  },
  description:
    "오늘의 특가부터 카테고리별 인기 랭킹, 솔직 리뷰까지. 입소문에서 확인하고 최저가로 구매하세요.",
  openGraph: {
    siteName: "입소문",
    type: "website",
    locale: "ko_KR",
    images: ["/og-default.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta
          name="naver-site-verification"
          content="58d80a68ed81e9188787cf42dc0b0b97eb858264"
        />
        {/* PWA — 홈 화면 추가 지원 */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#e8590c" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="입소문" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* Google AdSense — 환경변수가 있을 때만 로드한다 */}
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          ></script>
        )}
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
        <div className="notice-bar">
          이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
          수수료를 제공받습니다.
        </div>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="logo">
              입<span>소문</span>
            </Link>
            <SearchBar />
            <nav className="header-links">
              <a
                href={TELEGRAM_CHANNEL_URL}
                target="_blank"
                rel="noopener"
                className="tg-link"
              >
                📣 특가알림
              </a>
              <Link href="/compare">가격비교</Link>
              <Link href="/blog">리포트</Link>
              <Link href="/calc">계산기</Link>
              <Link href="/deals">오늘의 딜</Link>
              <Link href="/ranking">랭킹</Link>
              <Link href="/pick">기획전</Link>
              <Link href="/favorites">찜 ♥</Link>
              <UserMenu />
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

        <InstallPrompt />

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
              수수료를 제공받습니다. 또한 토스쇼핑 쉐어링크 활동의 일환으로,
              링크를 통한 구매가 발생하면 일정 수수료를 지급받습니다. 네이버,
              11번가, 오늘의집 등 제휴 링크를 통한 구매 시에도 수수료를 받을
              수 있습니다. 구매자에게 추가 비용은 발생하지 않으며, 표시된
              가격은 쿠폰 보유 등에 따라 변동될 수 있습니다.
            </p>
            <p className="footer-links">
              <Link href="/privacy">개인정보처리방침</Link>
              <span aria-hidden> · </span>
              <a href="mailto:t4n9332@gmail.com">문의·제휴 t4n9332@gmail.com</a>
            </p>
            <p>
              📣 매일 특가 브리핑:{" "}
              <a
                href={TELEGRAM_CHANNEL_URL}
                target="_blank"
                rel="noopener"
                style={{ color: "#5eb5f7", fontWeight: 600 }}
              >
                텔레그램 채널 구독하기
              </a>
            </p>
            <p>© {new Date().getFullYear()} 입소문</p>
          </div>
        </footer>
        <InstallPrompt />
      </body>
    </html>
  );
}
