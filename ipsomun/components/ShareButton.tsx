"use client";

import { useState } from "react";

/**
 * 상품 공유 버튼 — Web Share API, 실패·미지원 시 링크 복사, 그것도 안 되면 주소 표시.
 * - 사용자 취소(AbortError)만 조용히 끝내고, 인앱 브라우저·WebView의 NotAllowedError 같은
 *   실제 실패는 클립보드 폴백으로 흘려보낸다 (전에는 모든 예외에서 그냥 끝나 아무 반응이 없었다).
 * - text에 '쿠팡 X원 vs 토스 Y원'을 넣으면 카카오톡·스레드에서 받는 사람의 클릭률이 오른다.
 * - url에 utm_source=share가 붙어 GA4에서 공유 유입을 셀 수 있다.
 */
export default function ShareButton({
  title,
  text,
  url,
}: {
  title: string;
  text?: string;
  url?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  function flash(next: "copied" | "failed") {
    setState(next);
    setTimeout(() => setState("idle"), 2500);
  }

  async function share() {
    const shareUrl = url || window.location.href;
    const shareText = text || `입소문 — ${title}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `입소문 — ${title}`, text: shareText, url: shareUrl });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // 사용자가 취소
        // 그 외 실패는 아래 복사 폴백으로
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      flash("copied");
    } catch {
      // http 인앱 브라우저·권한 거부 — 최후 폴백으로 주소를 직접 보여준다
      try {
        window.prompt("아래 링크를 복사해 공유하세요", shareUrl);
      } catch {}
      flash("failed");
    }
  }

  return (
    <button
      className="fav-btn big share-btn"
      onClick={share}
      type="button"
      aria-live="polite"
    >
      {state === "copied" ? "✅ 링크 복사됨!" : state === "failed" ? "링크를 직접 복사해주세요" : "📤 공유하기"}
    </button>
  );
}
