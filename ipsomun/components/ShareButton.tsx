"use client";

import { useState } from "react";

/** 상품 공유 버튼 — Web Share API, 미지원 시 링크 복사 */
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `입소문 — ${title}`, url });
        return;
      } catch {
        return; // 사용자가 취소한 경우
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <button className="fav-btn big share-btn" onClick={share} type="button">
      {copied ? "✅ 링크 복사됨!" : "📤 공유하기"}
    </button>
  );
}
