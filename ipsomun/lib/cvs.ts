/**
 * 편의점 행사(1+1·2+1) — 데이터 모양과 계산 로직.
 *
 * 데이터는 scripts/cvs-collect.mjs 가 매월 1일 각 편의점 공식 행사 페이지에서 모아
 * data/cvs/current.json(이번 달)·previous.json(지난달)로 저장한다. 이 파일은 그 두 달을
 * 비교해 '버프/너프'(행사 조건이 좋아졌나 나빠졌나)와 '같은 상품 어디가 이득'을 계산한다.
 *
 * 순수 함수만 둔다 — 페이지·테스트·영상 스크립트가 같은 계산을 쓰게.
 */

export type BrandId = "gs25" | "cu" | "seven" | "emart24";
export type DealType = "1+1" | "2+1" | "3+1" | "덤";

export interface CvsItem {
  /** 편의점 */
  b: BrandId;
  /** 상품명 (원문) */
  n: string;
  /** 1개 가격(원) */
  p: number;
  /** 행사 종류 */
  t: DealType;
  /** 상품 이미지 URL */
  img?: string;
}

export interface CvsMonth {
  /** "2026-11" */
  month: string;
  generated_at: string;
  items: CvsItem[];
  /** 이번 달 수집에 실패해 지난 데이터를 그대로 쓴 편의점 */
  stale?: BrandId[];
}

/** 매장 수 순 (GS25·CU 2강, 세븐일레븐, 이마트24) */
export const BRANDS: { id: BrandId; name: string; short: string; color: string; webless?: string }[] = [
  {
    id: "gs25", name: "GS25", short: "GS", color: "#0a8fd8",
    // 2026 홈페이지 개편으로 공식 웹 행사 목록이 사라졌다 (행사 정보는 '우리동네GS' 앱)
    webless: "GS25는 2026년 홈페이지 개편 후 공식 웹에서 행사상품 목록을 제공하지 않아요. 행사 정보는 '우리동네GS' 앱에서 확인할 수 있어요.",
  },
  { id: "cu", name: "CU", short: "CU", color: "#7b3fa0" },
  { id: "seven", name: "세븐일레븐", short: "7E", color: "#00843d" },
  { id: "emart24", name: "이마트24", short: "E24", color: "#f5a800" },
];
export const brandName = (b: BrandId) => BRANDS.find((x) => x.id === b)?.name ?? b;
export const isBrand = (s: string): s is BrandId => BRANDS.some((b) => b.id === s);

export const DEAL_TYPES: DealType[] = ["1+1", "2+1", "3+1", "덤"];

/**
 * 행사 할인율 — 몇 개 값으로 몇 개를 가져가나.
 * 1+1 = 50%, 2+1 = 33%, 3+1 = 25%. '덤'(다른 상품 증정)은 값어치를 알 수 없어 낮게 친다.
 */
export function dealValue(t: DealType): number {
  switch (t) {
    case "1+1": return 1 / 2;
    case "2+1": return 1 / 3;
    case "3+1": return 1 / 4;
    default: return 0.1;
  }
}

/** 행사대로 샀을 때 1개당 실제 가격 */
export function unitPrice(it: Pick<CvsItem, "p" | "t">): number {
  return Math.round(it.p * (1 - dealValue(it.t)));
}

/**
 * 같은 상품 판별용 이름 정규화.
 * 편의점마다 "몬스터)울트라355ml", "몬스터 울트라 355ML" 처럼 표기가 달라 공백·괄호·기호를
 * 지우고 소문자로 맞춘다. 용량 숫자는 남긴다(250ml 와 355ml 는 다른 상품).
 */
export function normName(n: string): string {
  return n
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "") // [PB] 같은 머리말
    .replace(/[()（）\s·・_\-\/,.!~+*'"]/g, "");
}

export type ChangeKind = "buff" | "nerf" | "new" | "ended";
export interface CvsChange {
  kind: ChangeKind;
  b: BrandId;
  n: string;
  img?: string;
  before?: { t: DealType; p: number; unit: number };
  after?: { t: DealType; p: number; unit: number };
  /** 1개당 가격 변화율 (음수 = 싸짐). new/ended 는 0 */
  pct: number;
  /** 행사 종류가 바뀌었나 (1+1 ↔ 2+1). 아니면 정가만 바뀐 것 */
  typeChanged: boolean;
}

/** 지난달 → 이번 달, 편의점별로 같은 상품의 행사 조건 변화를 찾는다 */
export function diffMonths(prev: CvsItem[], cur: CvsItem[]): CvsChange[] {
  const key = (it: CvsItem) => `${it.b}|${normName(it.n)}`;
  const before = new Map(prev.map((it) => [key(it), it]));
  const after = new Map(cur.map((it) => [key(it), it]));
  const snap = (it: CvsItem) => ({ t: it.t, p: it.p, unit: unitPrice(it) });
  const out: CvsChange[] = [];

  for (const [k, a] of after) {
    const p = before.get(k);
    if (!p) {
      out.push({ kind: "new", b: a.b, n: a.n, img: a.img, after: snap(a), pct: 0, typeChanged: false });
      continue;
    }
    const pu = unitPrice(p);
    const au = unitPrice(a);
    if (au === pu) continue; // 조건·가격 그대로
    out.push({
      kind: au < pu ? "buff" : "nerf",
      b: a.b, n: a.n, img: a.img || p.img,
      before: snap(p), after: snap(a),
      pct: pu > 0 ? (au - pu) / pu : 0,
      typeChanged: a.t !== p.t,
    });
  }
  for (const [k, p] of before) {
    if (!after.has(k)) out.push({ kind: "ended", b: p.b, n: p.n, img: p.img, before: snap(p), pct: 0, typeChanged: false });
  }
  // 행사 종류가 바뀐 것(1+1 ↔ 2+1 — 진짜 '패치')이 먼저, 그 안에서 체감이 큰 순
  return out.sort(
    (x, y) => Number(y.typeChanged) - Number(x.typeChanged) || Math.abs(y.pct) - Math.abs(x.pct)
  );
}

export interface CrossDeal {
  name: string;
  img?: string;
  /** 1개당 가격이 싼 순 */
  offers: (CvsItem & { unit: number })[];
  /** 가장 비싼 곳 대비 가장 싼 곳의 1개당 절약액 */
  save: number;
}

/** 두 곳 이상에서 행사하는 같은 상품 — 어디서 사는 게 이득인지 */
export function crossBrand(cur: CvsItem[]): CrossDeal[] {
  const groups = new Map<string, CvsItem[]>();
  for (const it of cur) {
    const k = normName(it.n);
    if (k.length < 3) continue;
    const g = groups.get(k) || [];
    if (!g.some((x) => x.b === it.b)) g.push(it);
    groups.set(k, g);
  }
  const out: CrossDeal[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const offers = g.map((it) => ({ ...it, unit: unitPrice(it) })).sort((a, b) => a.unit - b.unit);
    out.push({
      name: offers[0].n,
      img: offers.find((o) => o.img)?.img,
      offers,
      save: offers[offers.length - 1].unit - offers[0].unit,
    });
  }
  return out.sort((a, b) => b.save - a.save);
}

/** "2026-11" → "11월" */
export const monthLabel = (m: string) => `${Number(m.slice(5, 7))}월`;
