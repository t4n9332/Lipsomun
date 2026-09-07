import type { Metadata } from "next";

/**
 * 찜 목록은 방문자마다 내용이 다르고(로컬 저장·계정 병합) 크롤러에게는 늘 비어 있다.
 * page.tsx가 "use client"라 metadata를 내보낼 수 없어 레이아웃에서 지정한다.
 */
export const metadata: Metadata = {
  title: "찜한 상품",
  robots: { index: false, follow: false },
  alternates: { canonical: "/favorites" },
};

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
