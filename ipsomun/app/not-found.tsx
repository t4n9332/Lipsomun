import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section" style={{ textAlign: "center", padding: "80px 0" }}>
      <div style={{ fontSize: 56 }}>🛒</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "12px 0 6px" }}>
        페이지를 찾을 수 없어요
      </h1>
      <p style={{ color: "#55524d", fontSize: 14.5, marginTop: 0 }}>
        주소가 바뀌었거나 삭제된 페이지예요.
        <br />
        오늘의 특가와 인기 랭킹은 그대로 있으니 둘러보세요!
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
        <Link href="/" className="btn">홈으로 가기</Link>
        <Link href="/deals" className="btn secondary">오늘의 딜 보기</Link>
      </div>
    </section>
  );
}
