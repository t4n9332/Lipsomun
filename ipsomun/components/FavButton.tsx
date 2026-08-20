"use client";

import { useEffect, useState } from "react";

const KEY = "ipsomun_favs";

export function getFavs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function setFavs(favs: string[]) {
  localStorage.setItem(KEY, JSON.stringify(favs));
}

export default function FavButton({
  slug,
  big = false,
}: {
  slug: string;
  big?: boolean;
}) {
  const [fav, setFav] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFav(getFavs().includes(slug));
    setReady(true);
  }, [slug]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const favs = getFavs();
    const on = !favs.includes(slug);
    const next = on ? [...favs, slug] : favs.filter((s) => s !== slug);
    setFavs(next);
    setFav(on);
    // 로그인 상태면 계정에도 저장 (비로그인이면 서버가 무시)
    fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, on }),
    }).catch(() => {});
  }

  return (
    <button
      className={`fav-btn${big ? " big" : ""}`}
      onClick={toggle}
      aria-label="찜하기"
      style={{ color: fav ? "#e8590c" : "#b3aea5", visibility: ready ? "visible" : "hidden" }}
    >
      {fav ? "♥" : "♡"}
      {big && (fav ? " 찜 완료" : " 찜하기")}
    </button>
  );
}
