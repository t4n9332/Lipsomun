"use client";

import { useEffect, useState } from "react";
import ProductCard, { CardProduct } from "@/components/ProductCard";
import { getFavs } from "@/components/FavButton";

export default function FavoritesPage() {
  const [items, setItems] = useState<CardProduct[] | null>(null);

  useEffect(() => {
    const favs = getFavs();
    if (favs.length === 0) {
      setItems([]);
      return;
    }
    fetch("/api/products?slugs=" + encodeURIComponent(favs.join(",")))
      .then((r) => r.json())
      .then((d) => setItems(d.products || []))
      .catch(() => setItems([]));
  }, []);

  return (
    <section className="section">
      <div className="section-head">
        <h2>♥ 내가 찜한 제품</h2>
        <span className="sub">이 기기에 저장됩니다</span>
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
