"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "ipsomun_theme";

/** 시스템 → 라이트 → 다크 순환. 선택은 localStorage에 남고 layout의 프리로드
 *  스크립트가 첫 페인트 전에 <html data-theme>를 맞춘다(깜빡임 방지). */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") setTheme(v);
    } catch {}
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }

  const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const label = theme === "system" ? "🌓 화면: 시스템" : theme === "light" ? "☀️ 화면: 밝게" : "🌙 화면: 어둡게";

  return (
    <button type="button" className="theme-toggle" onClick={() => apply(next)} aria-label="화면 테마 전환">
      {label}
    </button>
  );
}
