"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 산지직송 코너의 가로 탭 — 분류 하나만 펼쳐 보인다.
 *
 * 상품이 늘수록 세로 스크롤이 길어지므로(2026-09-04 사장님 지시) 분류를 탭으로 나눈다.
 * 모든 분류의 카드를 HTML 에 그대로 두고(검색엔진이 전부 읽게) 활성 탭 외에는 `hidden` 으로 감춘다.
 * `#과일` 처럼 해시로 들어오면 그 탭을 연다.
 *
 * 카드(패널)는 서버에서 그려 children 으로 받는다. 상품 배열을 props 로 넘기면
 * 수백 개 항목이 HTML 과 RSC 페이로드에 두 번 실려 페이지가 무거워진다 — 여기선 탭
 * 이름과 개수만 받고, 패널 표시/숨김은 DOM 의 hidden 속성만 바꾼다.
 */
export default function FarmTabs({
  tabs,
  children,
}: {
  tabs: { cat: string; count: number }[];
  children: ReactNode;
}) {
  const [active, setActive] = useState(tabs[0]?.cat ?? "");
  const panels = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (h && tabs.some((t) => t.cat === h)) setActive(h);
  }, [tabs]);

  useEffect(() => {
    panels.current
      ?.querySelectorAll<HTMLElement>("[role=tabpanel]")
      .forEach((el) => (el.hidden = el.id !== active));
  }, [active]);

  const pick = (cat: string) => {
    setActive(cat);
    try {
      window.history.replaceState(null, "", `#${encodeURIComponent(cat)}`);
    } catch {}
  };

  return (
    <>
      <div className="farm-tabs" role="tablist" aria-label="상품 분류">
        {tabs.map(({ cat, count }) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={cat === active}
            aria-controls={cat}
            className={cat === active ? "on" : ""}
            onClick={() => pick(cat)}
          >
            {cat}
            <span className="n">{count}</span>
          </button>
        ))}
      </div>
      <div ref={panels}>{children}</div>
    </>
  );
}
