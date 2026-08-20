"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "ipsomun_a2hs_dismissed";
const DISMISS_DAYS = 1; // 닫기 누르면 24시간 동안 다시 안 보임

type BipEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function markDismissed(days: number) {
  try {
    localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + days * 24 * 60 * 60 * 1000)
    );
  } catch {}
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BipEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // 서비스워커 등록 (푸시 + 홈화면 설치 공용)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // 이미 홈 화면 앱으로 실행 중이면 표시하지 않음
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // 최근에 닫았으면 표시하지 않음
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (until && Date.now() < until) return;
    } catch {}

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);

    // 안드로이드/크롬: 설치 프롬프트 이벤트를 잡아서 배너 표시
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BipEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS 사파리: beforeinstallprompt가 없으므로 안내 배너 표시
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (ios) timer = setTimeout(() => setShow(true), 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!show) return null;

  const close = () => {
    setShow(false);
    markDismissed(DISMISS_DAYS);
  };

  const install = async () => {
    if (!deferred) return;
    setShow(false);
    await deferred.prompt();
    try {
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") markDismissed(365);
      else markDismissed(DISMISS_DAYS);
    } catch {
      markDismissed(DISMISS_DAYS);
    }
    setDeferred(null);
  };

  return (
    <div className="a2hs-banner" role="dialog" aria-label="홈 화면에 추가">
      <img src="/icon-192.png" alt="" className="a2hs-icon" />
      <div className="a2hs-text">
        {isIos ? (
          <>
            <strong>홈 화면에 입소문 추가</strong>
            <span>
              하단 공유 버튼 <span aria-hidden>⎋</span> 을 누른 뒤{" "}
              <b>&lsquo;홈 화면에 추가&rsquo;</b>를 선택하세요
            </span>
          </>
        ) : (
          <>
            <strong>입소문을 홈 화면에 추가</strong>
            <span>앱처럼 바로 접속하고 특가 알림도 받아보세요</span>
          </>
        )}
      </div>
      {!isIos && deferred && (
        <button type="button" className="a2hs-install" onClick={install}>
          추가
        </button>
      )}
      <button
        type="button"
        className="a2hs-close"
        onClick={close}
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}
