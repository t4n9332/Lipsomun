"use client";

import { useEffect } from "react";

/**
 * 상품 페이지 조회수 보고.
 * 페이지가 ISR로 캐싱되면 서버 렌더가 방문마다 돌지 않으므로 조회수를 여기서 올린다.
 * 캐시된 HTML이 재사용되는 동안에도 방문자별로 정확히 1회 집계된다.
 */
export default function ViewTracker({ id }: { id: string }) {
  useEffect(() => {
    // React 18 StrictMode의 이중 실행과 뒤로가기 복원에서 중복 집계되지 않도록
    // 세션당 상품별 1회로 제한한다.
    const key = `ipsomun_viewed_${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // 프라이빗 모드 등 sessionStorage 불가 — 그대로 진행
    }
    const body = JSON.stringify({ id });
    // sendBeacon은 페이지를 즉시 떠나도 전송이 보장된다
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/view", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }, [id]);

  return null;
}
