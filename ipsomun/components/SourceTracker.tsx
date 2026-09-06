"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const COOKIE = "ipsomun_src";
const DAYS = 7;
const PV_KEY = "ipsomun_pv";

/**
 * 유입 채널 기록.
 * utm_source(텔레그램·스레드·네이버·푸시·공유)가 있으면 그 값을, 없고 외부에서 처음
 * 들어왔으면 referrer 호스트(google·naver·daum·bing…)를 7일 쿠키로 남긴다.
 * /go 리다이렉트가 이 쿠키를 읽어 채널별 클릭을 집계한다 — 어느 채널이 수익 클릭을
 * 만드는지 몰라서 운영자 체력을 어디에 쓸지 정할 수 없던 문제.
 * 세션 페이지뷰 수도 세어 둔다 (설치 배너 노출 조건).
 */
export default function SourceTracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const n = Number(sessionStorage.getItem(PV_KEY) || 0) + 1;
      sessionStorage.setItem(PV_KEY, String(n));
    } catch {}

    let source = "";
    try {
      const utm = new URLSearchParams(window.location.search).get("utm_source");
      if (utm && /^[a-z0-9_-]{1,40}$/i.test(utm)) source = utm.toLowerCase();
    } catch {}

    if (!source) {
      // 이미 출처가 있으면 referrer로 덮어쓰지 않는다 (utm 우선, 사이트 내부 이동은 무시)
      if (document.cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE}=`))) return;
      try {
        const ref = document.referrer ? new URL(document.referrer) : null;
        if (ref && ref.hostname !== window.location.hostname) {
          const h = ref.hostname.replace(/^www\./, "");
          source =
            /google\./.test(h) ? "google"
            : /naver\.com$/.test(h) ? "naver"
            : /daum\.net$/.test(h) ? "daum"
            : /bing\.com$/.test(h) ? "bing"
            : /threads\./.test(h) ? "threads"
            : /instagram\.com$/.test(h) ? "instagram"
            : /(^|\.)t\.co$|twitter\.com$|x\.com$/.test(h) ? "x"
            : /kakao/.test(h) ? "kakao"
            : h.slice(0, 40);
        }
      } catch {}
    }
    if (!source) return;

    const exp = new Date(Date.now() + DAYS * 864e5).toUTCString();
    document.cookie = `${COOKIE}=${encodeURIComponent(source)}; expires=${exp}; path=/; SameSite=Lax`;
  }, [pathname]);

  return null;
}
