"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const RECENT_KEY = "ipsomun_recent_searches";
const MAX_RECENT = 6;

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function pushRecent(q: string) {
  const next = [q, ...getRecent().filter((x) => x !== q)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

interface Suggestion {
  type: "product" | "category";
  text: string;
}

export default function SearchBar() {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // 입력 변경 → 자동완성 (200ms 디바운스)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = value.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setSuggestions(data.suggestions || []);
        setHighlight(-1);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  function go(q: string, isCategory = false) {
    const query = q.trim();
    if (!query) return;
    setOpen(false);
    if (isCategory) {
      router.push(`/category/${encodeURIComponent(query)}`);
      return;
    }
    pushRecent(query);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (highlight >= 0 && items[highlight]) {
      const it = items[highlight];
      go(it.text, it.type === "category");
    } else {
      go(value);
    }
  }

  function removeRecent(q: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = getRecent().filter((x) => x !== q);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecent(next);
  }

  const showRecent = !value.trim() && recent.length > 0;
  const items: Suggestion[] = showRecent
    ? recent.map((r) => ({ type: "product" as const, text: r }))
    : suggestions;
  const showDropdown = open && (showRecent || suggestions.length > 0);

  return (
    <form className="search-form" action="/search" onSubmit={onSubmit} ref={wrapRef}>
      <input
        name="q"
        placeholder="어떤 제품이 궁금하세요?"
        value={value}
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setRecent(getRecent());
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!showDropdown) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, -1));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <button type="submit" aria-label="검색">⌕</button>

      {showDropdown && (
        <div className="search-dropdown">
          {showRecent && <div className="sd-label">최근 검색어</div>}
          {items.map((it, i) => (
            <div
              key={`${it.type}-${it.text}`}
              className={`sd-item${i === highlight ? " active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                go(it.text, it.type === "category");
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span className="sd-icon">
                {showRecent ? "🕘" : it.type === "category" ? "📂" : "🔍"}
              </span>
              <span className="sd-text">
                {it.text}
                {it.type === "category" && <em> 카테고리</em>}
              </span>
              {showRecent && (
                <button
                  type="button"
                  className="sd-del"
                  aria-label="삭제"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => removeRecent(it.text, e)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
