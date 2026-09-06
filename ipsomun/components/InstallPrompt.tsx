"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const DISMISS_KEY = "ipsomun_a2hs_dismissed";
const DISMISS_COUNT_KEY = "ipsomun_a2hs_dismiss_n";
const PV_KEY = "ipsomun_pv";
const DISMISS_DAYS = 7; // 닫기 누르면 7일 동안 다시 안 보임 (두 번째부터 30일)

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

function dismissDays(): number {
  try {
    const n = Number(localStorage.getItem(DISMISS_COUNT_KEY) || 0) + 1;
    localStorage.setItem(DISMISS_COUNT_KEY, String(n));
    return n >= 2 ? 30 : DISMISS_DAYS;
  } catch {
    return DISMISS_DAYS;
  }
}

/**
 * 홈 화면 추가 배너.
 * - 첫 페이지뷰에서는 띄우지 않는다 (검색·SNS로 처음 들어온 사람이 상품을 보기도 전에
 *   설치 배너를 보면 닫기만 누른다). 세션 내 2번째 페이지뷰부터.
 * - 상품 페이지(/p/)에서는 띄우지 않는다 — 하단은 고정 구매 바가 쓴다.
 * - 서비스워커 등록은 배너와 무관하게 항상 한다 (푸시 수신용).
 */
export default function InstallPrompt() {
  const pathname = usePathname();
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

    // 세션 첫 페이지뷰·상품 페이지에서는 표시하지 않음
    let pv = 1;
    try {
      pv = Number(sessionStorage.getItem(PV_KEY) || 1);
    } catch {}
    const onProduct = pathname?.startsWith("/p/");
    if (pv < 2 || onProduct) return;

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
  }, [pathname]);

  if (!show) return null;

  const close = () => {
    setShow(false);
    markDismissed(dismissDays());
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
            <span>찜한 상품 가격이 내려가면 알려드려요</span>
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
