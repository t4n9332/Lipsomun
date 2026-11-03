"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CvsItem, DealType } from "@/lib/cvs";
import CvsCard from "./CvsCard";

const STEP = 96;

/**
 * 편의점 행사 목록 — 탭(1+1·2+1…) + 검색 + 더 보기.
 * 서버가 탭마다 앞부분(initial)만 HTML 로 그려 보내고, 사용자가 '더 보기'를 누르거나 검색하면
 * /cvs/data/{brand} 전체 목록을 그때 받아온다. 처음 열 때 수천 개를 다 받지 않게.
 */
export default function CvsBrowser({
  dataUrl,
  tabs,
  initial,
  showBrand = false,
}: {
  /** 전체 목록 JSON 주소 (/cvs/data/seven, /cvs/data/c/음료 …) */
  dataUrl: string;
  tabs: { t: DealType; count: number }[];
  initial: Partial<Record<DealType, CvsItem[]>>;
  /** 여러 편의점을 섞어 보여줄 때 카드에 편의점 이름 표시 */
  showBrand?: boolean;
}) {
  const [active, setActive] = useState<DealType>(tabs[0]?.t);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState<number>(initial[tabs[0]?.t]?.length || STEP);
  const [all, setAll] = useState<CvsItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const load = () => {
    if (all || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    fetch(dataUrl)
      .then((r) => r.json())
      .then((items: CvsItem[]) => setAll(items))
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
  };

  // #2+1 처럼 해시로 들어오면 그 탭을 연다
  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.slice(1)) as DealType;
    if (tabs.some((x) => x.t === h)) setActive(h);
  }, [tabs]);

  const needle = q.trim().toLowerCase().replace(/\s+/g, "");
  useEffect(() => {
    if (needle) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle]);

  const list = useMemo(() => {
    if (needle) {
      const src = all || Object.values(initial).flat() as CvsItem[];
      return src.filter((x) => x.n.toLowerCase().replace(/\s+/g, "").includes(needle));
    }
    const src = all ? all.filter((x) => x.t === active) : initial[active] || [];
    return src;
  }, [needle, all, active, initial]);

  const total = needle ? list.length : tabs.find((x) => x.t === active)?.count || 0;
  const shown = list.slice(0, limit);

  const pick = (t: DealType) => {
    setActive(t);
    setLimit(initial[t]?.length || STEP);
    try {
      window.history.replaceState(null, "", `#${encodeURIComponent(t)}`);
    } catch {}
  };

  return (
    <>
      <div className="cvs-search">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="상품 이름으로 찾기 (예: 몬스터, 바나나우유)"
          aria-label="행사 상품 검색"
        />
        {needle && (
          <span className="n" aria-live="polite">
            {loading && !all ? "찾는 중…" : `${list.length}개`}
          </span>
        )}
      </div>

      {!needle && (
        <div className="farm-tabs" role="tablist" aria-label="행사 종류">
          {tabs.map(({ t, count }) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === active}
              className={t === active ? "on" : ""}
              onClick={() => pick(t)}
            >
              {t}
              <span className="n">{count}</span>
            </button>
          ))}
        </div>
      )}

      <section className="section" role="tabpanel">
        <div className="grid cvs-grid">
          {shown.map((it, k) => (
            <CvsCard key={`${it.b}-${it.n}-${it.t}-${k}`} it={it} showBrand={showBrand} />
          ))}
        </div>
        {shown.length < total && (
          <div className="cvs-more">
            <button
              type="button"
              className="btn"
              disabled={loading}
              onClick={() => {
                load();
                setLimit((n) => n + STEP);
              }}
            >
              {loading ? "불러오는 중…" : `더 보기 (${shown.length} / ${total})`}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
