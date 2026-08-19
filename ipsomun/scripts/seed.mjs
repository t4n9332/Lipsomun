// 데모용 샘플 데이터 등록 스크립트 (선택 사항)
// 사용법: DATABASE_URL이 설정된 상태에서  npm run db:seed
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SAMPLES = [
  {
    title: "샘플) 무선 물걸레 청소기",
    category: "생활용품",
    price: 89000,
    originalPrice: 129000,
    isDeal: true,
    description: "손목에 무리 없는 셀프 스탠딩 무선 물걸레",
    review:
      "일주일 써본 후기입니다.\n\n물걸레질이 정말 편해졌어요. 무게 중심이 아래에 있어 손목에 부담이 적고, 물 분사 버튼이 손잡이에 있어 편합니다.",
    pros: "가벼운 무게\n셀프 스탠딩\n세척 쉬운 패드",
    cons: "배터리 40분은 조금 아쉬움",
  },
  {
    title: "샘플) 스테인리스 에어프라이어 5.5L",
    category: "주방용품",
    price: 79900,
    originalPrice: 99000,
    isDeal: true,
    description: "코팅 걱정 없는 올스텐 내솥",
    review: "",
    pros: "",
    cons: "",
  },
  {
    title: "샘플) 접이식 캠핑 의자",
    category: "스포츠/레저",
    price: 24900,
    originalPrice: null,
    isDeal: false,
    description: "1kg 초경량, 수납백 포함",
    review: "",
    pros: "",
    cons: "",
  },
];

function slugify(t) {
  return (
    t
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product"
  );
}

for (const s of SAMPLES) {
  const id = crypto.randomUUID();
  const slug = slugify(s.title) + "-" + id.slice(0, 4);
  await pool.query(
    `INSERT INTO products (id,title,slug,description,category,price,original_price,is_deal,review,pros,cons)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
    [id, s.title, slug, s.description, s.category, s.price, s.originalPrice, s.isDeal, s.review, s.pros, s.cons]
  );
  console.log("등록:", s.title);
}

await pool.end();
console.log("완료! (샘플 제품은 관리자 페이지에서 삭제할 수 있습니다)");
