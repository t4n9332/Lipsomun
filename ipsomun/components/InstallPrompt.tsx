"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "ipsomun_install_dismissed";
const VISIT_KEY = "ipsomun_visits";
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA 홈화면 추가 유도 배너.
 * - 2번째 방문부터, 닫으면 14일간 다시 보이지 않음
 * - 안드로이드/데스크톱: 브라우저 설치 프롬프트 호출
 * - iOS 사파리: 공유 → 홈 화면에 추가 안내
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // 이미 설치(standalone)면 표시하지 않음
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;
    if (standalone) return;

    // 닫은 지 14일 안 지났으면 표시하지 않음
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissed && Date.now() - dismissed < DISMISS_DAYS * 86400_000) return;

    // 방문 횟수 집계 — 2번째 방문부터 노출
    const visits = Number(localStorage.getItem(VISIT_KEY) || 0) + 1;
    localStorage.setItem(VISIT_KEY, String(visits));
    if (visits < 2) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);

    if (ios) {
      setShow(true);
      return;
    }

    function onBip(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    }
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setShow(false);
    else dismiss();
    setDeferred(null);
  }

  if (!show) return null;

  return (
    <div className="install-banner" role="dialog" aria-label="앱 설치 안내">
      <span className="ib-icon">🏠</span>
      <div className="ib-text">
        <b>입소문을 홈 화면에 추가하세요</b>
        {isIos ? (
          <span>
            사파리 하단 <b>공유 버튼 ⎋</b> → <b>홈 화면에 추가</b>를 누르면 앱처럼
            쓸 수 있어요.
          </span>
        ) : (
          <span>매일 특가를 앱처럼 빠르게 확인할 수 있어요.</span>
        )}
      </div>
      {!isIos && (
        <button className="btn sm" onClick={install}>
          추가하기
        </button>
      )}
      <button className="ib-close" onClick={dismiss} aria-label="닫기">
        ×
      </button>
    </div>
  );
}
