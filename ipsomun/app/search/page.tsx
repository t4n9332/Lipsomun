import Link from "next/link";
import { searchProductsDb, withLinks, type SearchSort } from "@/lib/db";
import { CATEGORIES } from "@/lib/util";
import ProductCard from "@/components/ProductCard";
import CvsCard from "@/components/CvsCard";
import { CALCULATORS } from "@/lib/calculators";
import { TOOLS } from "@/lib/tools";
import { categoryOf, categorySlug, unitPrice } from "@/lib/cvs";
import { CUR as CVS } from "@/lib/cvsData";

/** 검색어 정규화 — 공백 무시, 소문자 */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** 계산기·도구 — 제목·키워드에 검색어가 있거나, 흔한 생활어(주휴·알바·퇴사…)로 찾을 때 */
const SYNONYMS: Record<string, string[]> = {
  시급월급: ["주휴", "알바", "최저임금", "시급", "아르바이트"],
  연봉실수령액: ["월급", "실수령", "세후", "4대보험"],
  퇴직금: ["퇴사", "퇴직"],
  실업급여: ["퇴사", "실업", "구직급여"],
  연말정산환급금: ["연말정산", "13월", "환급", "월세공제", "의료비공제"],
  연금저축IRP세액공제: ["연금저축", "irp", "세액공제"],
  종합소득세: ["종소세", "프리랜서", "5월"],
  연차수당: ["연차"],
  대출갈아타기: ["대출", "대환", "중도상환"],
};
function matchCalcs(q: string) {
  const n = norm(q);
  if (n.length < 2) return [];
  const calcs = CALCULATORS.filter((c) =>
    norm([c.title, c.short, ...c.keywords].join(" ")).includes(n) ||
    (SYNONYMS[c.slug] || []).some((w) => n.includes(norm(w)) || norm(w).includes(n))
  )
    // 이름에 검색어가 직접 들어간 계산기를 앞으로
    .sort((a, b) => Number(norm(b.short).includes(n)) - Number(norm(a.short).includes(n)))
    .map((c) => ({ href: `/calc/${encodeURIComponent(c.slug)}`, emoji: c.emoji, title: c.short, desc: c.desc }));
  const tools = TOOLS.filter((t) => norm([t.title, t.short].join(" ")).includes(n)).map((t) => ({
    href: `/tools/${encodeURIComponent(t.slug)}`, emoji: t.emoji, title: t.short, desc: t.desc,
  }));
  return [...calcs, ...tools].slice(0, 4);
}

/** 이번 달 편의점 행사 중 이름이 맞는 것 — 1개당 싼 순 */
function matchCvs(q: string) {
  const n = norm(q);
  if (n.length < 2) return [];
  return CVS.items
    .filter((it) => norm(it.n).includes(n))
    .sort((a, b) => unitPrice(a) - unitPrice(b));
}

export const dynamic = "force-dynamic";
/**
 * 검색 결과는 색인하지 않는다. `?q=` 조합마다 URL이 생기는 무한 공간이고 내용이 얇아
 * 색인 비대(index bloat)를 만든다. 링크는 따라가게 둬서 상품 페이지 발견에는 쓰이게 한다.
 */
export const metadata = {
  title: "검색",
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

const SORTS: { key: SearchSort; label: string }[] = [
  { key: "relevance", label: "인기순" },
  { key: "discount", label: "할인율순" },
  { key: "price_asc", label: "낮은 가격순" },
  { key: "price_desc", label: "높은 가격순" },
  { key: "rating", label: "평점순" },
];

function buildHref(q: string, sort: string, cat: string) {
  const p = new URLSearchParams({ q });
  if (sort && sort !== "relevance") p.set("sort", sort);
  if (cat) p.set("cat", cat);
  return `/search?${p.toString()}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; cat?: string }>;
}) {
  const { q, sort: sortRaw, cat: catRaw } = await searchParams;
  const query = (q || "").trim();
  const sort: SearchSort = SORTS.some((s) => s.key === sortRaw)
    ? (sortRaw as SearchSort)
    : "relevance";
  const cat = CATEGORIES.includes(catRaw || "") ? catRaw! : "";

  const items = query
    ? await withLinks(await searchProductsDb(query, 60, sort, cat || undefined))
    : [];

  // 결과에 존재하는 카테고리만 필터로 노출 (필터 미적용 상태 기준)
  const allItems =
    query && cat ? await searchProductsDb(query, 60, sort) : items;
  const availableCats = Array.from(new Set(allItems.map((p) => p.category)));
  const calcHits = query ? matchCalcs(query) : [];
  const cvsHits = query ? matchCvs(query) : [];

  return (
    <section className="section">
      <div className="section-head">
        <h1>&lsquo;{query}&rsquo; 검색 결과</h1>
        <span className="sub">{items.length}개</span>
      </div>

      {calcHits.length > 0 && (
        <div className="home-info search-calcs">
          {calcHits.map((c) => (
            <Link key={c.href} href={c.href}>
              <strong>
                {c.emoji} {c.title}
              </strong>
              <span>{c.desc.slice(0, 60)}…</span>
            </Link>
          ))}
        </div>
      )}

      {cvsHits.length > 0 && (
        <div className="search-cvs">
          <div className="section-head">
            <h2>🏪 이번 달 편의점 행사 {cvsHits.length}개</h2>
            <Link className="more" href={`/cvs/c/${encodeURIComponent(categorySlug(categoryOf(cvsHits[0].n)))}`}>
              {categoryOf(cvsHits[0].n)} 행사 전체 →
            </Link>
          </div>
          <div className="grid cvs-grid">
            {cvsHits.slice(0, 8).map((it, k) => (
              <CvsCard key={k} it={it} showBrand />
            ))}
          </div>
        </div>
      )}

      {query && allItems.length > 0 && (
        <div className="search-tools">
          <div className="sort-tabs">
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={buildHref(query, s.key, cat)}
                className={sort === s.key ? "active" : ""}
              >
                {s.label}
              </Link>
            ))}
          </div>
          {availableCats.length > 1 && (
            <div className="cat-filter">
              <Link href={buildHref(query, sort, "")} className={!cat ? "active" : ""}>
                전체
              </Link>
              {availableCats.map((c) => (
                <Link
                  key={c}
                  href={buildHref(query, sort, c)}
                  className={cat === c ? "active" : ""}
                >
                  {c}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        calcHits.length + cvsHits.length === 0 && (
          <div className="empty">
            검색 결과가 없습니다. 다른 키워드로 검색해 보세요.
          </div>
        )
      ) : (
        <div className="grid">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
