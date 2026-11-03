"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 서버에서 그린 카드(data-name)를 이름으로 거른다.
 * 상품 배열을 props 로 넘기면 수천 개가 HTML·RSC 페이로드에 두 번 실리므로 DOM 만 만진다.
 */
export default function CvsSearch({ target, placeholder }: { target: string; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const root = document.getElementById(target);
      if (!root) return;
      const needle = q.trim().toLowerCase().replace(/\s+/g, "");
      let n = 0;
      root.querySelectorAll<HTMLElement>("[data-name]").forEach((el) => {
        const hit = !needle || (el.dataset.name || "").replace(/\s+/g, "").includes(needle);
        el.style.display = hit ? "" : "none";
        if (hit) n++;
      });
      // 검색 중에는 탭 구분 없이 전체에서 찾는다
      root.querySelectorAll<HTMLElement>("[role=tabpanel]").forEach((p) => {
        if (needle) p.dataset.searching = "1";
        else delete p.dataset.searching;
      });
      setShown(needle ? n : null);
    }, 120);
  }, [q, target]);

  return (
    <div className="cvs-search">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || "상품 이름으로 찾기 (예: 몬스터, 바나나우유)"}
        aria-label="행사 상품 검색"
      />
      {shown != null && <span className="n" aria-live="polite">{shown}개</span>}
    </div>
  );
}
