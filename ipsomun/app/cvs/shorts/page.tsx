import type { Metadata } from "next";
import { brandName, monthLabel, type CvsCategory } from "@/lib/cvs";
import { CUR, PREV, HAS_PREV, CHANGES, CROSS, bestSaving } from "@/lib/cvsData";
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
  // 행사 종류가 바뀐 것만으로 채우고, 모자라면 정가 변동으로 메운다 (CHANGES 가 이미 그 순서)
  const buffs = CHANGES.filter((c) => c.kind === "buff").slice(0, 5);
  const nerfs = CHANGES.filter((c) => c.kind === "nerf").slice(0, 4);
  // 지난달 데이터가 없는 달(패치노트 없음)에는 '어디가 이득'·'분류별 꿀템'을 더 넣어 영상을 채운다
  const versusN = HAS_PREV ? 2 : 4;
  const bestCats = (HAS_PREV ? ["음료", "과자·간식"] : ["음료", "과자·간식", "간편식", "아이스크림"]) as CvsCategory[];
  const bests = bestCats.flatMap((c) => bestSaving(c).map((it) => ({ c, it })));
  const slides: Slide[] = [
    { kind: "intro", title: HAS_PREV ? `${M} 편의점 패치노트` : `${M} 편의점 1+1 꿀템`, sub: HAS_PREV ? `${monthLabel(PREV.month)} → ${M} · GS25 · CU · 세븐 · 이마트24` : "GS25 · CU · 세븐 · 이마트24" },
    ...buffs.map((c): Slide => ({
      kind: "buff",
      brand: brandName(c.b), brandId: c.b, name: c.n, img: c.img ? imgUrl(c.img, 600) : undefined,
      from: c.before?.t, to: c.after?.t, fromUnit: c.before?.unit, toUnit: c.after?.unit, pct: c.pct,
      fromPrice: c.before?.p, toPrice: c.after?.p,
    })),
    ...nerfs.map((c): Slide => ({
      kind: "nerf",
      brand: brandName(c.b), brandId: c.b, name: c.n, img: c.img ? imgUrl(c.img, 600) : undefined,
      from: c.before?.t, to: c.after?.t, fromUnit: c.before?.unit, toUnit: c.after?.unit, pct: c.pct,
      fromPrice: c.before?.p, toPrice: c.after?.p,
    })),
    ...bests.map(({ c, it }): Slide => ({
      kind: "best", cat: c, brand: brandName(it.b), brandId: it.b, name: it.n,
      img: it.img ? imgUrl(it.img, 600) : undefined, t: it.t, price: it.p, unit: it.unit, saved: it.saved,
    })),
    ...CROSS.filter((x) => x.save > 0).slice(0, versusN).map((x): Slide => ({
      kind: "versus", name: x.name, img: x.img ? imgUrl(x.img, 600) : undefined,
      offers: x.offers.slice(0, 4).map((o) => ({ brand: brandName(o.b), brandId: o.b, t: o.t, unit: o.unit })),
    })),
    { kind: "outro", title: HAS_PREV ? "전체 패치노트는" : "전체 행사·비교는", sub: "lipsomun.co.kr/cvs" },
  ];
  return <CvsShorts slides={slides} />;
}
