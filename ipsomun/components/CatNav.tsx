"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CatNav({ categories }: { categories: string[] }) {
  const pathname = usePathname();
  let decodedPathname = pathname || "";
  try {
    decodedPathname = decodeURIComponent(decodedPathname);
  } catch {}

  return (
    <nav className="cat-nav">
      {categories.map((c) => {
        const href = `/category/${encodeURIComponent(c)}`;
        const active = decodedPathname === `/category/${c}`;
        return (
          <Link
            key={c}
            href={href}
            className={active ? "active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {c}
          </Link>
        );
      })}
    </nav>
  );
}
