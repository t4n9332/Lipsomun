import Link from "next/link";
import { getPosts } from "@/lib/db";
import { won } from "@/lib/util";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "가격비교 리포트",
  description:
    "매일 자동 발행되는 쿠팡 vs 토스쇼핑 최저가 비교 리포트. 오늘 어떤 상품이 얼마나 저렴한지 확인하세요.",
};

interface ParsedMeta {
  count: number;
  totalSavings: number;
  top: string;
}

function parseMeta(content: string): ParsedMeta | null {
  try {
    const c = JSON.parse(content);
    return {
      count: c.items?.length ?? 0,
      totalSavings: c.totalSavings ?? 0,
      top: c.items?.[0]?.title ?? "",
    };
  } catch {
    return null;
  }
}

export default async function BlogListPage() {
  const posts = await getPosts(60);

  return (
    <section className="section">
      <div className="section-head">
        <h2>📝 가격비교 리포트</h2>
        <span className="sub">매일 자동 발행되는 쿠팡 vs 토스 최저가 리포트</span>
      </div>
      {posts.length === 0 ? (
        <div className="empty">첫 리포트를 준비 중입니다. 내일 아침에 만나요!</div>
      ) : (
        <div className="post-list">
          {posts.map((p) => {
            const meta = parseMeta(p.content);
            return (
              <Link key={p.id} href={`/blog/${p.slug}`} className="post-item">
                <b>{p.title}</b>
                {meta && (
                  <span className="post-sub">
                    가격차 큰 상품 {meta.count}개 · 최대 절약 합계{" "}
                    {won(meta.totalSavings)}
                    {meta.top && ` · 1위: ${meta.top.slice(0, 30)}…`}
                  </span>
                )}
                <span className="post-date">
                  {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
