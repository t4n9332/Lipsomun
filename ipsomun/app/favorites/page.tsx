"use client";

import { useEffect, useState } from "react";
import ProductCard, { CardProduct } from "@/components/ProductCard";
import { getFavs } from "@/components/FavButton";

export default function FavoritesPage() {
  const [items, setItems] = useState<CardProduct[] | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    (async () => {
      let favs = getFavs();
      // 로그인 상태면 기기 찜을 계정에 병합하고, 계정 찜 전체를 사용
      try {
        const res = await fetch("/api/favorites", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugs: favs }),
        }).then((r) => r.json());
        if (res.loggedIn) {
          setLoggedIn(true);
          favs = res.slugs || favs;
          try {
            localStorage.setItem("ipsomun_favs", JSON.stringify(favs));
          } catch {}
        }
      } catch {}

      if (favs.length === 0) {
        setItems([]);
        return;
      }
      fetch("/api/products?slugs=" + encodeURIComponent(favs.join(",")))
        .then((r) => r.json())
        .then((d) => setItems(d.products || []))
        .catch(() => setItems([]));
    })();
  }, []);

  return (
    <section className="section">
      <div className="section-head">
        <h2>♥ 내가 찜한 제품</h2>
        <span className="sub">
          {loggedIn
            ? "계정에 저장돼요 · 가격이 내려가면 알림을 보내드려요"
            : "이 기기에 저장됩니다 · 로그인하면 계정에 보관되고 가격인하 알림도 받아요"}
        </span>
      </div>
      {items === null ? (
        <div className="empty">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="empty">
          아직 찜한 제품이 없어요. 마음에 드는 제품의 ♡를 눌러보세요!
        </div>
      ) : (
        <div className="grid">
          {items.map((p) => (
            <ProductCard key={p.slug} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
