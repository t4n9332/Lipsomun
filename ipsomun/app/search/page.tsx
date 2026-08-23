import Link from "next/link";
import { searchProductsDb, type SearchSort } from "@/lib/db";
import { CATEGORIES } from "@/lib/util";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "검색" };

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

  const items = query ? await searchProductsDb(query, 60, sort, cat || undefined) : [];

  // 결과에 존재하는 카테고리만 필터로 노출 (필터 미적용 상태 기준)
  const allItems =
    query && cat ? await searchProductsDb(query, 60, sort) : items;
  const availableCats = Array.from(new Set(allItems.map((p) => p.category)));

  return (
    <section className="section">
      <div className="section-head">
        <h2>&lsquo;{query}&rsquo; 검색 결과</h2>
        <span className="sub">{items.length}개</span>
      </div>

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
        <div className="empty">
          검색 결과가 없습니다. 다른 키워드로 검색해 보세요.
        </div>
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
