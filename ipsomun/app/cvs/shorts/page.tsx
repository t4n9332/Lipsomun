import type { Metadata } from "next";
import { brandName, monthLabel } from "@/lib/cvs";
import { CUR, PREV, HAS_PREV, CHANGES, CROSS } from "@/lib/cvsData";
import { imgUrl } from "@/lib/util";
import CvsShorts, { type Slide } from "@/components/CvsShorts";

/**
 * 유튜브 쇼츠용 9:16 슬라이드 — '게임 패치노트' 콘셉트.
 * scripts/cvs-shorts.mjs 가 이 페이지를 Playwright 로 녹화해 영상 파일로 만든다.
 * 검색에 노출할 페이지가 아니므로 noindex.
 */
export const dynamic = "force-static";
export const metadata: Metadata = { title: "편의점 패치노트 쇼츠", robots: { index: false, follow: false } };

export default function ShortsPage() {
  const M = monthLabel(CUR.month || "0000-00");
  const buffs = CHANGES.filter((c) => c.kind === "buff").slice(0, 5);
  const nerfs = CHANGES.filter((c) => c.kind === "nerf").slice(0, 4);
  const slides: Slide[] = [
    { kind: "intro", title: `${M} 편의점 패치노트`, sub: HAS_PREV ? `${monthLabel(PREV.month)} → ${M} · GS25 · CU · 세븐 · 이마트24` : "GS25 · CU · 세븐 · 이마트24" },
    ...buffs.map((c): Slide => ({
      kind: "buff",
      brand: brandName(c.b), brandId: c.b, name: c.n, img: c.img ? imgUrl(c.img, 600) : undefined,
      from: c.before?.t, to: c.after?.t, fromUnit: c.before?.unit, toUnit: c.after?.unit, pct: c.pct,
    })),
    ...nerfs.map((c): Slide => ({
      kind: "nerf",
      brand: brandName(c.b), brandId: c.b, name: c.n, img: c.img ? imgUrl(c.img, 600) : undefined,
      from: c.before?.t, to: c.after?.t, fromUnit: c.before?.unit, toUnit: c.after?.unit, pct: c.pct,
    })),
    ...CROSS.slice(0, 2).map((x): Slide => ({
      kind: "versus", name: x.name, img: x.img ? imgUrl(x.img, 600) : undefined,
      offers: x.offers.slice(0, 4).map((o) => ({ brand: brandName(o.b), brandId: o.b, t: o.t, unit: o.unit })),
    })),
    { kind: "outro", title: "전체 패치노트는", sub: "lipsomun.co.kr/cvs" },
  ];
  return <CvsShorts slides={slides} />;
}
