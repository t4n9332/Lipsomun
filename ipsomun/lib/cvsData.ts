/**
 * 편의점 행사 데이터 로더 (서버 전용).
 * data/cvs/*.json 은 매월 1일 GitHub Actions 가 갈아끼우고, 커밋되면 Vercel 이 다시 빌드한다.
 * 그래서 /cvs 페이지는 전부 정적(force-static) — DB 를 쓰지 않는다.
 */
import current from "@/data/cvs/current.json";
import previous from "@/data/cvs/previous.json";
import {
  CATEGORIES,
  categoryOf,
  categorySlug,
  crossBrand,
  diffMonths,
  unitPrice,
  type CvsCategory,
  type CvsItem,
  type CvsMonth,
} from "@/lib/cvs";

export const CUR = current as CvsMonth;
export const PREV = previous as CvsMonth;
export const HAS_DATA = CUR.items.length > 0;
/** 지난달 데이터가 있어야 버프/너프를 낼 수 있다 (첫 달은 없음) */
export const HAS_PREV = PREV.items.length > 0 && PREV.month !== CUR.month;

export const CHANGES = HAS_PREV ? diffMonths(PREV.items, CUR.items) : [];
export const CROSS = crossBrand(CUR.items);

/** 분류별 상품 — 1개당 가격이 싼 순 (4사 통합) */
export function itemsInCategory(c: CvsCategory): CvsItem[] {
  return CUR.items
    .filter((it) => categoryOf(it.n) === c)
    .sort((a, b) => unitPrice(a) - unitPrice(b));
}

/**
 * 분류별 '꿀템' — 1+1·2+1 중 1개당 아끼는 금액(정가 − 1개당 가격)이 가장 큰 행사.
 * 1개당 가격이 제일 싼 것만 고르면 70ml 짜리 같은 소용량이 뽑혀 체감이 적다.
 */
const CHEAP = new Set<CvsCategory>(["음료", "과자·간식", "아이스크림"]);

export function bestSaving(c: CvsCategory, n = 1): (CvsItem & { unit: number; saved: number })[] {
  // 묶음(24팩·4입·*20)·고가 상품은 할인액이 커도 '편의점에서 하나 집어 드는' 꿀템이 아니라 뺀다
  const BUNDLE = /\d+\s*(입|팩|개입|P|봉|매)(?![가-힣a-z])|\*\s*\d|박스|세트/i;
  return itemsInCategory(c)
    // 과자·음료·아이스크림은 편의점 기준 5천원 넘으면 대용량·냉동식품이 섞여 들어온다 (분류 규칙의 'g·ml' 꼬리 때문)
    .filter((it) => it.t !== "덤" && it.p <= (CHEAP.has(c) ? 5_000 : 10_000) && !BUNDLE.test(it.n))
    .map((it) => ({ ...it, unit: unitPrice(it), saved: it.p - unitPrice(it) }))
    .sort((a, b) => b.saved - a.saved)
    .slice(0, n);
}

/** 허브·내비게이션용: 분류별 개수 */
export const CATEGORY_COUNTS = CATEGORIES.map((c) => ({
  c,
  slug: categorySlug(c),
  count: CUR.items.filter((it) => categoryOf(it.n) === c).length,
}));
