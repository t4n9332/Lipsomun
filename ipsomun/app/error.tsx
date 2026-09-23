"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="section" style={{ textAlign: "center", padding: "80px 0" }}>
      <div style={{ fontSize: 56 }}>😵</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "12px 0 6px" }}>
        일시적인 오류가 발생했어요
      </h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14.5, marginTop: 0 }}>
        페이지를 다시 불러오거나 홈으로 돌아가 보세요.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
        <button onClick={() => reset()} className="btn">다시 시도</button>
        <Link href="/" className="btn secondary">홈으로 가기</Link>
      </div>
    </section>
  );
}
