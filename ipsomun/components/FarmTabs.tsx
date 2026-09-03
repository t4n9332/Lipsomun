"use client";

import { useEffect, useState } from "react";
import FarmCard, { type FarmItem } from "./FarmCard";

/**
 * 산지직송 코너의 가로 탭 — 분류 하나만 펼쳐 보인다.
 *
 * 상품이 늘수록 세로 스크롤이 길어지므로(2026-09-04 사장님 지시) 분류를 탭으로 나눈다.
 * 모든 분류의 카드를 HTML 에 그대로 두고(검색엔진이 전부 읽게) 활성 탭 외에는 `hidden` 으로 감춘다.
 * `#과일` 처럼 해시로 들어오면 그 탭을 연다.
 */
export default function FarmTabs({ groups }: { groups: [string, FarmItem[]][] }) {
  const [active, setActive] = useState(groups[0]?.[0] ?? "");

  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (h && groups.some(([c]) => c === h)) setActive(h);
  }, [groups]);

  const pick = (cat: string) => {
    setActive(cat);
    try {
      window.history.replaceState(null, "", `#${encodeURIComponent(cat)}`);
    } catch {}
  };

  return (
    <>
      <div className="farm-tabs" role="tablist" aria-label="상품 분류">
        {groups.map(([cat, list]) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={cat === active}
            className={cat === active ? "on" : ""}
            onClick={() => pick(cat)}
          >
            {cat}
            <span className="n">{list.length}</span>
          </button>
        ))}
      </div>
      {groups.map(([cat, list]) => (
        <section className="section farm-panel" key={cat} id={cat} role="tabpanel" hidden={cat !== active}>
          <div className="section-head">
            <h2>{cat}</h2>
            <span className="sub">{list.length}개</span>
          </div>
          <div className="grid">
            {list.map((p) => (
              <FarmCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
