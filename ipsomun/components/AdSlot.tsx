"use client";

import { useEffect, useRef } from "react";
import { isPlaceholderSlot } from "@/lib/adSlots";

/**
 * 애드센스 광고 자리.
 *
 * 제휴 링크와 광고가 섞이면 독자가 헷갈리고 애드센스 정책에도 걸린다.
 * 그래서 구매 버튼 근처에는 두지 않고, 본문·계산기 아래처럼
 * "읽고 나서 다음 행동을 고민하는 지점"에만 배치한다.
 *
 * 슬롯 ID는 lib/adSlots.ts 에서 가져온다. 아직 만들지 않은 슬롯(PLACEHOLDER)이면
 * 아무것도 렌더하지 않는다 — 없는 슬롯 ID로 <ins> 를 그리면 광고는 안 채워지면서
 * 자리만 비어 보이고, 애드센스 콘솔에도 오류로 남는다.
 */
export default function AdSlot({
  slot,
  format = "auto",
  label = true,
}: {
  slot: string;
  format?: "auto" | "fluid";
  label?: boolean;
}) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    // 개발 중이거나 클라이언트 ID가 없으면 아무것도 하지 않는다
    if (pushed.current) return;
    if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT) return;
    if (isPlaceholderSlot(slot)) return;
    try {
      // @ts-expect-error 애드센스가 전역에 주입한다
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      /* 광고 차단기 등 — 조용히 넘어간다 */
    }
  }, []);

  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return null;
  // 슬롯을 아직 안 만들었으면 그리지 않는다 (lib/adSlots.ts 참조)
  if (isPlaceholderSlot(slot)) return null;

  return (
    <div className="ad-slot">
      {label && <span className="ad-label">광고</span>}
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
