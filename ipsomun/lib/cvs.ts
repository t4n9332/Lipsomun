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

/* ---------- 상품 분류 ---------- */

/**
 * 상품명만으로 대분류를 붙인다. 편의점 공식 목록에는 분류가 없거나 제각각이라
 * "편의점 음료 1+1" 처럼 분류별로 4사를 묶어 보여주려면 직접 나눠야 한다.
 * 규칙은 위에서부터 먼저 맞는 것이 이긴다 (예: '무알콜' 맥주는 주류가 아니라 음료).
 * 못 맞추면 '기타' — 틀리게 넣는 것보다 낫다.
 */
export const CATEGORIES = ["음료", "과자·간식", "간편식", "아이스크림", "주류", "생활용품", "기타"] as const;
export type CvsCategory = (typeof CATEGORIES)[number];

const CATEGORY_RULES: [CvsCategory, RegExp][] = [
  ["생활용품", /순면|샤프란|피죤|다우니|립케어|AA\d|AAA|라이너|탐폰|키친타올|타올|엠보|무표백|\d+매|왁스|클렌징|시트\d|울트라|날개|흡수|입는|입오버|\d+P\(|치약|칫솔|가그린|리스테린|샴푸|린스|바디워시|핸드워시|물티슈|티슈|화장지|마스크|세제|섬유유연|면도|생리대|오버나이트|팬티라이너|중형|대형\)|밴드|건전지|세럼|립밤|립테라피|로션|핸드크림|선크림|티셔츠|양말|스타킹|우산|충전|케이블|라이터|봉투|헤어|염색|탈취|방향제|살충|모기/],
  ["음료", /무알콜|무알코올|비알콜|0\.0/],
  ["주류", /카스|테라|켈리|하이트|클라우드|필라이트|버드와이저|하이네켄|칭따오|아사히|기네스|호가든|산미구엘|코젤|타이거|라들러|참이슬|처음처럼|진로|새로|좋은데이|청하|복분자|매화수|맥주|라거|에일|소주|하이볼|와인|막걸리|위스키|사케|레몬진|모스카토|소비뇽|멜롯|까베르네|샴페인|스파클링와인|칵테일|진토닉|샤도네이|샤르도네|리슬링|피노누아|비비노|\d(\.\d)?도\d/],
  ["아이스크림", /아이스크림|빙수|메로나|부라보|싸만코|돼지바|누가바|비비빅|빵빠레|월드콘|구구콘|설레임|폴라포|빠삐코|더위사냥|쿠앤크|하겐다즈|나뚜루|찰떡아이스|멜로바|소다향바|아맛나|탱크보이|죠스바|스크류바|와일드바디|로우슈거데이|젤라또|파르페|요맘때|젤로바|파인트|라벨리|라라스윗|바카바카|셔요|샌드\D*\d+ml|컵\d+ml|콘\d+ml/],
  ["간편식", /도시락|김밥|삼각|주먹밥|샌드위치|햄버거|버거|라면|컵누들|컵면|우동|짬뽕|짜장|볶음밥|덮밥|비빔밥|햇반|즉석밥|흑미밥|죽\d|죽$|만두|소시지|후랑크|핫바|맥스봉|스팸|리챔|닭가슴살|닭다리|치킨|너겟|튀김|어묵|오뎅|국밥|육개장|찌개|탕\d|육수|떡볶이|피자|핫도그|크림파스타|파스타|카레|짜파|불닭|비빔면|냉면|컵밥|계란|훈제란|반찬|김치|참치|햄\d|프랑크|크랩|맛살|목살|삼겹|스테이크|한우|한돈|불고기|닭갈비|제육|쌀국수|사발|낫또|볶음면|큰컵|소컵|꼬치|컵반|김\d+봉|김밥/],
  // 양념·조미료는 어디에도 딱 맞지 않아 '기타'로 뺀다 (간편식 뒤 — '참기름김치볶음밥'은 간편식)
  ["기타", /고추장|된장|쌈장|액젓|케첩|마요네즈|식초|참기름|들기름|굴소스|맛술|다시다|소금|설탕/],
  ["음료", /우유|커피|라떼|아메리카노|카페|콜드브루|음료|주스|쥬스|에이드|아이스티|녹차|홍차|보리차|헛개|옥수수수염|차\d|콜라|사이다|스프라이트|환타|탄산|토닉|워터|생수|샘물|스파클링|에너지|핫식스|레드불|몬스터|이온|포카리|게토레이|파워에이드|비타500|박카스|두유|요구르트|요거트|엔요|야쿠르트|식혜|수정과|코코넛|밀크티|초코에몽|드링킹|셀렉스|모카\d|액티비아|웰치|베지밀|오트|쉐이크|레몬즙|아메P|보리P|(P|펫|캔)\d{3}|[가-힣](3[0-9]{2}|500|1000)$|바나나맛|딸기맛우유|제로\d*ml|\d+ml$|\d+ml\)|펫|캔\d|파우치/i],
  ["과자·간식", /린도|린트|포키|리콜라|오레오|죠리퐁|시리얼|그래놀라|이클립스|민트|코피코|타르트|과자|칩|스낵|쿠키|초코|캔디|젤리|껌|파이|비스킷|크래커|팝콘|견과|피스타치오|아몬드|땅콩|호두|캐슈|츄|사탕|웨하스|킨더|프링글스|새우깡|포테이토|빼빼로|도넛|빵|케이크|롤케|카스테라|마카롱|떡|양갱|육포|오징어|쥐포|치즈|맛콩|짱구|바\d+g|\d+g$|\d+g\)|\d+g\(\d+\)$/i],
];

export function categoryOf(name: string): CvsCategory {
  const n = name.replace(/\s/g, "");
  for (const [cat, re] of CATEGORY_RULES) if (re.test(n)) return cat;
  return "기타";
}

/** 주소에 쓰는 분류 이름 ('과자·간식' 의 가운뎃점은 그대로 두면 인코딩이 길어 하이픈으로) */
export const categorySlug = (c: CvsCategory) => c.replace("·", "-");
export const categoryFromSlug = (s: string) =>
  CATEGORIES.find((c) => categorySlug(c) === decodeURIComponent(s)) || null;
