// 제휴 상품 ↔ 산지직송 교차 노출 매칭 — 엉뚱한 상품을 붙이지 않는지가 핵심
import test from "node:test";
import assert from "node:assert/strict";
import { foodKeywords, farmPicksFor, type FarmItemLite } from "../lib/farm-match.ts";

const item = (over: Partial<FarmItemLite>): FarmItemLite => ({
  id: over.id || Math.random().toString(36).slice(2),
  group_id: over.group_id || over.id || Math.random().toString(36).slice(2),
  title: "상품",
  category: "기타",
  image: "",
  price_from: 10000,
  options: [{ name: "1kg", price: 10000, soldout: false }],
  naver_url: "https://smartstore.naver.com/x/products/1",
  coupang_url: "",
  season_kind: "",
  peak_months: [],
  created_at: "2026-11-01",
  ...over,
});

const FARM: FarmItemLite[] = [
  item({ id: "a1", group_id: "G1", title: "제주 황금향 선물용 2kg", category: "과일", peak_months: [11, 12] }),
  item({ id: "a2", group_id: "G1", title: "제주 황금향 선물용 5kg", category: "과일", peak_months: [11, 12] }),
  item({ id: "b1", title: "안동 사과 선물용", category: "과일", peak_months: [10, 11] }),
  item({ id: "c1", title: "샤인머스켓 [프리미엄]", category: "과일", peak_months: [8, 9] }),
  item({ id: "d1", title: "전라도 묵은지 김치 1kg", category: "김치·반찬" }),
  item({ id: "d2", title: "전라도 포기 김치 1kg", category: "김치·반찬" }),
  item({ id: "e1", title: "돌문어 가정용 [생물] 1kg", category: "수산물" }),
  item({ id: "f1", title: "나주 신고배 5kg", category: "과일" }),
  item({ id: "g1", title: "품절 감귤", category: "과일", options: [{ name: "1kg", price: 1, soldout: true }] }),
];

test("키워드: 긴 것(구체적) 먼저, 그 일부는 뒤에", () => {
  assert.deepEqual(foodKeywords("백송식품 동해안 마른오징어 20마리").map((h) => h.keyword), ["마른오징어", "오징어"]);
  assert.equal(foodKeywords("어사김치 전라도 김장배추 포기김치")[0].keyword, "김치");
});

test("키워드: '오리지널'·'새우깡'·'배추'·'배터리'는 식품 키워드가 아니다", () => {
  assert.deepEqual(foodKeywords("하루견과 시그니처 오리지널 22g"), []);
  assert.deepEqual(foodKeywords("농심 새우깡 90g"), []);
  assert.ok(!foodKeywords("김장배추 절임").some((h) => h.keyword === "배"));
  assert.ok(foodKeywords("[로켓프레시] 나주 GAP 인증 당도선별 알뜰배 3~6입").some((h) => h.keyword === "배"));
});

test("직접 매칭 우선 + 같은 그룹(용량별)은 하나만 + 품절 제외 + 제철 우선", () => {
  const r = farmPicksFor({ title: "어사김치 전라도 김장배추 포기김치", category: "식품" }, FARM, { month: 11 });
  assert.deepEqual(r.items.map((i) => i.id).sort(), ["d1", "d2"]);
  assert.equal(r.category, "김치·반찬");
  assert.equal(r.keyword, "김치");

  const g = farmPicksFor({ title: "올레길 AI 당도선별 11brix 감귤", category: "식품" }, FARM, { month: 11 });
  // 감귤 직접 매칭은 품절뿐 → 과일 분류에서 제철(11월) 먼저 채운다, 황금향은 1개만
  assert.equal(g.items.filter((i) => i.group_id === "G1").length, 1);
  assert.ok(!g.items.some((i) => i.id === "g1"));
  assert.ok(g.items.slice(0, 2).every((i) => i.peak_months.includes(11)));
});

test("식품이 아니거나 키워드가 없으면 붙이지 않는다", () => {
  assert.equal(farmPicksFor({ title: "사과 향 바디워시", category: "뷰티" }, FARM).items.length, 0);
  assert.equal(farmPicksFor({ title: "햇반 찰잡곡밥 210g", category: "식품" }, FARM).items.length, 0);
});

test("'기타'로 잘못 분류된 농산물(나주 배)도 붙는다", () => {
  const r = farmPicksFor({ title: "[로켓프레시] 나주 GAP 인증 당도선별 알뜰배 3~6입", category: "기타" }, FARM, { month: 11 });
  assert.equal(r.items[0].id, "f1");
});

// 2026-11-24 실데이터에서 나온 오매칭 — 다시 생기면 여기서 걸린다
test("실데이터 오매칭 회귀: 띄어쓰기·가공식품·고기 종류", () => {
  const MEAT: FarmItemLite[] = [
    item({ id: "m1", title: "++한우선물세트", category: "축산물" }),
    item({ id: "m2", title: "한돈 냉장 목살 (구이용) 0.5kg", category: "축산물" }),
    item({ id: "fr", title: "제철 단감 특과 2kg", category: "과일", peak_months: [11] }),
  ];
  // '소중한 우리쌀'을 붙여 쓰면 '한우'가 생긴다
  assert.equal(farmPicksFor({ title: "곰곰 소중한 우리쌀 현미밥", category: "식품" }, MEAT).items.length, 0);
  // 닭은 한우·한돈으로 잇지 않는다
  assert.equal(farmPicksFor({ title: "굽네 크리스피 닭가슴살 (냉동)", category: "식품" }, MEAT).items.length, 0);
  // 제육은 돼지고기
  assert.deepEqual(farmPicksFor({ title: "곰곰 고추장 제육 불고기", category: "식품" }, MEAT).items.map((i) => i.id), ["m2"]);
  // 과일 맛 음료는 분류로 채우지 않는다
  assert.equal(farmPicksFor({ title: "환타 제로 오렌지 탄산음료", category: "식품" }, MEAT, { month: 11 }).items.length, 0);
  assert.equal(farmPicksFor({ title: "갈아만든배", category: "식품" }, MEAT, { month: 11 }).items.length, 0);
});
