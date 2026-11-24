/**
 * 제휴 상품 ↔ 산지직송(운영자 직판, data/farm.json) 교차 노출 매칭 (2026-11-24)
 *
 * 왜: 쿠팡 수수료는 ~3%, 토스 ~10%인데 산지직송은 운영자 스토어라 판매 마진이 통째로 남는다.
 * 같은 방문자를 마진이 큰 쪽으로 이어 주는 것이 트래픽을 늘리지 않고 수익을 올리는 방법이다.
 *
 * 규칙(보수적으로 — 엉뚱한 상품을 붙이면 신뢰를 잃는다):
 *   1) 상품 제목에서 식품 키워드를 찾는다(긴 키워드 우선: '마른오징어' > '오징어', '묵은지' > '김치').
 *   2) 같은 키워드가 제목에 든 산지직송 상품을 먼저(직접 매칭), 모자라면 그 키워드의 분류에서 채운다.
 *   3) 키워드가 하나도 없으면 아무것도 붙이지 않는다. 식품이 아닌 카테고리도 붙이지 않는다.
 *   같은 상품의 용량별 등록(group_id)은 하나로 묶고, 전 옵션 품절은 뺀다. 제철(peak_months) 상품을 앞에 둔다.
 */

export interface FarmOptionLite {
  name: string;
  price: number;
  soldout: boolean;
}
export interface FarmItemLite {
  id: string;
  group_id: string;
  title: string;
  category: string;
  image: string;
  price_from: number;
  options: FarmOptionLite[];
  naver_url: string;
  coupang_url: string;
  season_kind: string;
  peak_months: number[];
  created_at: string;
}

/** [키워드, 산지직송 분류]. 순서는 상관없다(길이순으로 다시 정렬). 한 글자 키워드는 넣지 않는다 — '배'는 따로 처리. */
const KEYWORDS: [string, string][] = [
  // 과일
  ...["사과", "감귤", "한라봉", "황금향", "천혜향", "레드향", "귤", "딸기", "포도", "샤인머스켓", "곶감", "반건시",
    "감말랭이", "단감", "홍시", "키위", "블루베리", "복숭아", "자두", "수박", "참외", "멜론", "토마토", "망고",
    "바나나", "레몬", "오렌지", "체리", "대추", "무화과", "석류", "아보카도"].map((k) => [k, "과일"] as [string, string]),
  // 채소
  ...["고구마", "감자", "양파", "마늘", "대파", "쪽파", "당근", "오이", "애호박", "단호박", "버섯", "표고", "시금치",
    "상추", "브로콜리", "파프리카", "옥수수", "미나리", "양배추", "연근", "우엉", "도라지", "더덕", "쑥"].map(
    (k) => [k, "채소"] as [string, string]
  ),
  // 수산물
  ...["고등어", "삼치", "갈치", "조기", "굴비", "오징어", "문어", "낙지", "쭈꾸미", "주꾸미", "새우", "대게", "킹크랩",
    "꽃게", "전복", "홍합", "바지락", "꼬막", "연어", "장어", "광어", "우럭", "전어", "소라", "멍게", "해삼",
    "가리비", "미더덕", "매생이", "미역", "다시마", "톳", "꼬시래기"].map((k) => [k, "수산물"] as [string, string]),
  // 건어물 (수산물보다 길거나 구체적이라 먼저 걸린다)
  ...["마른오징어", "반건조오징어", "쥐포", "황태", "북어", "멸치", "건새우", "진미채", "오징어채", "명태채", "김자반",
    "돌자반"].map((k) => [k, "건어물"] as [string, string]),
  // 축산물
  ...["한우", "소고기", "돼지고기", "흑돼지", "삼겹", "목살", "항정", "갈비", "불고기", "닭가슴살", "닭다리", "닭고기",
    "오리", "육포", "차돌", "등심", "안심", "사태", "양지"].map((k) => [k, "축산물"] as [string, string]),
  // 김치·반찬
  ...["김치", "묵은지", "깍두기", "석박지", "총각김치", "열무", "젓갈", "새우젓", "명란", "창난", "장아찌", "소라장",
    "게장", "간장게장", "양념게장", "멸치볶음", "장조림", "김장양념"].map((k) => [k, "김치·반찬"] as [string, string]),
  // 밀키트
  ...["밀키트", "전골", "부대찌개", "샤브샤브"].map((k) => [k, "밀키트"] as [string, string]),
];
const KEYWORDS_SORTED = [...KEYWORDS].sort((a, b) => b[0].length - a[0].length);

/** 식품이 아닌 카테고리는 붙이지 않는다('기타'는 분류 오류가 잦아 허용 — 예: 나주 배가 '기타'였다) */
const FOOD_CATEGORIES = new Set(["식품", "기타"]);

/** 식품 키워드처럼 보이지만 아닌 말 — 키워드를 찾기 전에 지운다 ('오리지널'의 '오리', '새우깡'의 '새우' 등) */
const FALSE_FRIENDS = /오리지널|오리진|새우깡|감자깡|감자칩|고구마깡|양파링|꽃게랑|조기교육|사과문|배추흰나비|갈아만든배/g;

/** '배'(과일)는 한 글자라 '배추·배송·배터리'와 헷갈린다 — 띄어 쓴 낱말이 '배'이거나 '…배'로 끝날 때만 인정 */
function hasPear(title: string): boolean {
  return title
    .replace(FALSE_FRIENDS, " ")
    .split(/[\s,()[\]/+·]+/)
    .some((w) => w === "배" || (/^[가-힣]{1,4}배$/.test(w) && !/(새우배|나룻배|고깃배|유람배)$/.test(w)));
}

/** 낱말 단위로 자른다 — 띄어쓰기를 지우고 찾으면 '소중한 우리쌀'에서 '한우'가 나온다(2026-11-24 실데이터) */
function words(title: string): string[] {
  return title
    .toLowerCase()
    .replace(FALSE_FRIENDS, " ")
    .split(/[\s,()[\]{}/+·|~!]+/)
    .filter(Boolean);
}

/** 제목에서 찾은 식품 키워드(구체적인 것부터). 길이순이라 구체적인 키워드('마른오징어')가 먼저, 그 일부('오징어')는 뒤에 온다. */
export function foodKeywords(title: string): { keyword: string; category: string }[] {
  const ws = words(title);
  const hits: { keyword: string; category: string }[] = [];
  for (const [k, cat] of KEYWORDS_SORTED) {
    if (!ws.some((w) => w.includes(k))) continue;
    hits.push({ keyword: k, category: cat }); // 길이순이라 '총각김치' 다음에 '김치'가 온다 — 긴 쪽 직접 매칭이 없을 때 쓰인다
  }
  if (hasPear(title)) hits.push({ keyword: "배", category: "과일" });
  return hits;
}

/**
 * 가공식품·음료 표시. 이런 상품은 '레몬맛 탄산수 → 감귤 세트'처럼 분류로 채우면 엉뚱해지므로
 * 같은 키워드의 산지직송 상품이 있을 때(직접 매칭)만 붙인다.
 */
const PROCESSED_WORD =
  /^(음료|.*탄산.*|콜라|사이다|.*에이드|.*주스|.*쥬스|.*즙|.*차|.*잼|시럽|.*젤리|사탕|과자|.*칩|스낵|.*우유|요거트|요구르트|아이스크림|.*카스테라|케이크|.*빵|.*떡|인절미|.*소스|.*식초|.*라면|.*조림|.*볶음|.*볶음밥|.*무침|.*튀김|.*까스|.*맛|.*향|분말|.*가루|캔디|초콜릿|.*청)$/;
const KEYWORD_SET = new Set(KEYWORDS.map(([k]) => k));
/** 낱말 하나라도 가공식품 표시면 true — 단, 그 낱말이 과일 이름 자체면('황금향'·'천혜향') 제외 */
function isProcessed(title: string): boolean {
  return words(title).some((w) => PROCESSED_WORD.test(w) && !KEYWORD_SET.has(w));
}

/** 고기는 종류가 다르면 이어 주지 않는다(닭가슴살 → 한우 선물세트, 한돈 등심 → 한우 꽃등심을 막는다) */
type Species = "beef" | "pork" | "chicken" | "duck";
function species(title: string): Species | null {
  const t = title.toLowerCase();
  if (/우삼겹/.test(t)) return "beef"; // '삼겹'이 들어 있지만 소고기
  if (/제육|한돈|돼지|흑돼지|삼겹|목살|항정|등갈비|돈육|돈까스|족발|보쌈/.test(t)) return "pork";
  if (/닭|치킨/.test(t)) return "chicken";
  if (/(^|[^가-힣])오리|오리고기|훈제오리|오리백숙/.test(t)) return "duck";
  if (/한우|소고기|육우|우삼겹|차돌|양지|사태|안심|불고기|la갈비|엘에이갈비|꽃등심|갈비살|우둔|홍두깨|채끝|부채살/.test(t)) return "beef";
  return null;
}

/** 크기·등급만 다른 비슷한 상품('호박고구마 특상 2kg' / '호박고구마 대 3kg')을 하나로 보기 위한 키 */
const GRADE_WORDS = new Set(["대", "중", "소", "특", "특대과", "대과", "중과", "소과", "특상", "특과", "정품", "가정용", "선물용", "선물세트", "실속", "프리미엄", "한입", "로얄과", "못난이"]);
function baseKey(title: string): string {
  return title
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/\d+(\.\d+)?\s*(kg|g|ml|l|개|입|구|팩|봉|미|마리|박스|과)/gi, " ")
    .split(/[\s·,]+/)
    .filter((w) => w && !GRADE_WORDS.has(w))
    .join("")
    .slice(0, 8);
}

/** 산지직송 데이터의 분류가 틀린 경우가 있다('국내산 민물장어'가 채소) — 제목 키워드로 다시 판단하고, 없으면 원래 분류 */
function farmCategory(i: FarmItemLite): string {
  return foodKeywords(i.title)[0]?.category ?? i.category;
}

function available(i: FarmItemLite) {
  return i.naver_url && (!i.options?.length || i.options.some((o) => !o.soldout));
}

function farmHasKeyword(i: FarmItemLite, keyword: string) {
  if (keyword === "배") return hasPear(i.title);
  return words(i.title).some((w) => w.includes(keyword));
}

/** 직접 매칭은 분류가 같을 때만(새우 → 새우젓 방지). 수산물·건어물은 서로 통한다(오징어 ↔ 마른오징어). */
function sameFamily(hitCat: string, farmCat: string) {
  if (hitCat === farmCat) return true;
  const sea = new Set(["수산물", "건어물"]);
  return sea.has(hitCat) && sea.has(farmCat);
}

export interface FarmPicks {
  items: FarmItemLite[];
  /** 산지직송 코너의 어느 탭으로 보낼지 (/farm#분류) */
  category: string | null;
  /** 직접 매칭된 키워드 (안내 문구용) */
  keyword: string | null;
}

/**
 * 제휴 상품 하나에 붙일 산지직송 상품을 고른다.
 * @param month 1~12 (제철 우선 정렬). 서버 렌더 시점의 한국 시각 월을 넘긴다.
 */
export function farmPicksFor(
  product: { title: string; category: string },
  farmItems: FarmItemLite[],
  { limit = 3, month = new Date(Date.now() + 9 * 3600 * 1000).getUTCMonth() + 1 } = {}
): FarmPicks {
  const none: FarmPicks = { items: [], category: null, keyword: null };
  if (!FOOD_CATEGORIES.has(product.category)) return none;
  const hits = foodKeywords(product.title);
  if (!hits.length) return none;
  const processed = isProcessed(product.title);
  const meat = hits[0].category === "축산물";
  const sp = meat ? species(product.title) : null;
  if (meat && !sp) return none; // 고기 종류를 알 수 없으면(예: '등심'만) 붙이지 않는다

  // 같은 상품의 용량별 등록(group_id)·크기만 다른 비슷한 상품은 하나만
  const seen = new Set<string>();
  const pool = farmItems.filter((i) => {
    if (!available(i)) return false;
    if (meat && species(i.title) !== sp) return false;
    const keys = [i.group_id || i.id, i.category + baseKey(i.title)];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
  const inSeason = (i: FarmItemLite) => (i.peak_months?.includes(month) ? 0 : 1);
  const bySeason = (a: FarmItemLite, b: FarmItemLite) => inSeason(a) - inSeason(b);

  const picked: FarmItemLite[] = [];
  let matchedKeyword: string | null = null;
  for (const h of hits) {
    const direct = pool
      .filter((i) => !picked.includes(i) && sameFamily(h.category, farmCategory(i)) && farmHasKeyword(i, h.keyword))
      .sort(bySeason);
    if (direct.length && !matchedKeyword) matchedKeyword = h.keyword;
    picked.push(...direct.slice(0, limit - picked.length));
    if (picked.length >= limit) break;
  }
  const category = hits[0].category;
  // 분류로 채우기: 가공식품은 하지 않는다. 고기는 위 pool 에서 이미 같은 종류만 남았다.
  if (picked.length < limit && !processed) {
    const fill = pool.filter((i) => !picked.includes(i) && farmCategory(i) === category).sort(bySeason);
    picked.push(...fill.slice(0, limit - picked.length));
  }
  return { items: picked, category: picked.length ? category : null, keyword: matchedKeyword };
}

/** 제철 상품 위주로 한 분류(또는 전체)에서 n개 — 카테고리 페이지 배너용 */
export function farmSeasonal(
  farmItems: FarmItemLite[],
  { limit = 4, month = new Date(Date.now() + 9 * 3600 * 1000).getUTCMonth() + 1 } = {}
): FarmItemLite[] {
  const seenGroup = new Set<string>();
  return farmItems
    .filter((i) => {
      if (!available(i) || !i.peak_months?.includes(month)) return false;
      const g = i.group_id || i.id;
      if (seenGroup.has(g)) return false;
      seenGroup.add(g);
      return true;
    })
    .slice(0, limit);
}

/**
 * 명절 선물용 산지직송(/seollal) — 제목에 선물·보자기·가방포장이 있는 상품만.
 * 크기만 다른 같은 계열(영광굴비 오가세트 20~25cm 여러 개)은 가장 싼 것 하나만 남겨 페이지를 짧게 한다.
 */
export function farmGiftItems(farmItems: FarmItemLite[]): FarmItemLite[] {
  const gifts = farmItems
    .filter((i) => available(i) && /선물|보자기|가방포장/.test(i.title))
    .sort((a, b) => a.price_from - b.price_from);
  const seen = new Set<string>();
  return gifts.filter((i) => {
    const key = baseKey(i.title.replace(/\(1\+1\)\s*/, "1+1 ").replace(/\d+\s*-\s*\d+\s*cm/gi, ""));
    const g = i.group_id || i.id;
    if (seen.has(key) || seen.has(g)) return false;
    seen.add(key);
    seen.add(g);
    return true;
  });
}
