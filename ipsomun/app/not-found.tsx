import Link from "next/link";

/**
 * 404 — 골드박스 특가는 매일 바뀌어 예전에 공유된 상품 링크로 들어오는 방문자가 많다.
 * 버튼 두 개로는 대부분 그냥 나가므로, 찾던 걸 바로 검색하고 고유 콘텐츠(편의점·계산기)로 이어지게 한다.
 */
export default function NotFound() {
  return (
    <section className="section" style={{ textAlign: "center", padding: "64px 0" }}>
      <div style={{ fontSize: 56 }}>🛒</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "12px 0 6px" }}>페이지를 찾을 수 없어요</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14.5, marginTop: 0 }}>
        특가가 끝났거나 주소가 바뀐 페이지예요. 찾던 상품을 바로 검색해 보세요.
      </p>
      <form action="/search" method="get" className="nf-search" role="search">
        <input type="search" name="q" placeholder="상품·편의점 행사·계산기 검색" aria-label="검색어" />
        <button className="btn" type="submit">검색</button>
      </form>
      <div className="home-info nf-links">
        <Link href="/deals">
          <strong>🔥 오늘의 딜</strong>
          <span>매일 갱신되는 특가</span>
        </Link>
        <Link href="/cvs">
          <strong>🏪 편의점 행사</strong>
          <span>이번 달 1+1·2+1, 어디가 이득</span>
        </Link>
        <Link href="/calc">
          <strong>🧮 생활 계산기</strong>
          <span>연말정산·주휴수당·실업급여</span>
        </Link>
      </div>
    </section>
  );
}
