"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CatNav from "@/components/CatNav";

/**
 * 쇼핑 하위 메뉴 — 가격비교·오늘의 딜·랭킹·기획전 탭과 카테고리 줄.
 * 2026-11-14 헤더 정리: 메뉴 11개 + 카테고리 줄이 모든 페이지 상단을 두 줄로 차지해
 * 헤더는 큰 갈래 5개만 두고, 쇼핑 세부 메뉴는 쇼핑 페이지에서만 보이게 옮겼다.
 * (편의점·계산기·산지직송 페이지에서 상품 카테고리가 보이면 남의 메뉴처럼 읽힌다)
 */
const TABS = [
  { href: "/compare", label: "🆚 가격비교" },
  { href: "/deals", label: "🔥 오늘의 딜" },
  { href: "/ranking", label: "🏆 랭킹" },
  { href: "/pick", label: "🧺 기획전" },
];
const SHOP_PREFIXES = ["/compare", "/deals", "/ranking", "/pick", "/category", "/search"];

export function isShopPath(p: string) {
  return SHOP_PREFIXES.some((x) => p === x || p.startsWith(x + "/"));
}

export default function ShopNav({ categories }: { categories: string[] }) {
  const pathname = usePathname() || "";
  if (!isShopPath(pathname)) return null;
  return (
    <div className="container shop-nav">
      <nav className="shop-tabs" aria-label="쇼핑 메뉴">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link key={t.href} href={t.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      <CatNav categories={categories} />
    </div>
  );
}
