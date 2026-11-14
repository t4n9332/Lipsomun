"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isShopPath } from "@/components/ShopNav";

/** 헤더 큰 갈래 5개 — 지금 있는 갈래를 표시한다(쇼핑 하위 페이지는 모두 '가격비교'로). */
const ITEMS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/compare", label: "가격비교", match: isShopPath },
  { href: "/cvs", label: "편의점", match: (p) => p.startsWith("/cvs") },
  { href: "/calc", label: "계산기", match: (p) => p.startsWith("/calc") || p.startsWith("/tools") },
  { href: "/farm", label: "산지직송", match: (p) => p.startsWith("/farm") },
  { href: "/favorites", label: "찜 ♥", match: (p) => p.startsWith("/favorites") },
];

export default function HeaderNav() {
  const p = usePathname() || "";
  return (
    <>
      {ITEMS.map((it) => {
        const on = it.match(p);
        return (
          <Link key={it.href} href={it.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
