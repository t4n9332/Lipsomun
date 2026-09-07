import type { Metadata } from "next";

/**
 * 마이페이지는 로그인한 본인에게만 의미가 있고 크롤러에게는 빈 껍데기다.
 * page.tsx가 "use client"라 metadata를 내보낼 수 없어 레이아웃에서 지정한다.
 */
export const metadata: Metadata = {
  title: "마이페이지",
  robots: { index: false, follow: false },
  alternates: { canonical: "/my" },
};

export default function MyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
