import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostBySlug, getPosts } from "@/lib/db";
import { won } from "@/lib/util";

export const revalidate = 1800; // 블로그 본문 — 발행 후 거의 불변

// 동적 세그먼트는 generateStaticParams가 없으면 revalidate가 무시된다.
// 빈 배열 = 빌드 때는 생성 안 하고 첫 요청 때 만들어 캐시에 올린다.
export function generateStaticParams() {
  return [];
}

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";

interface CompareItem {
  slug: string;
  title: string;
  imageUrl: string;
  coupang: number;
  toss: number;
  rating: number | null;
  ratingCount: number | null;
  savings: number;
}

interface LowItem {
  slug: string;
  title: string;
  price: number | null;
}

interface DailyCompare {
  type: string;
  date: string;
  items: CompareItem[];
  lows?: LowItem[];
  totalCompare: number;
  totalSavings: number;
}

function parse(content: string): DailyCompare | null {
  try {
    const c = JSON.parse(content);
    if (c?.type !== "daily-compare" || !Array.isArray(c.items)) return null;
    return c as DailyCompare;
  } catch {
    return null;
  }
}

// 날짜 기반으로 도입부를 돌려가며 사용 (매일 같은 문장 반복 방지)
const INTROS = [
  "같은 상품이라도 어디서 사느냐에 따라 가격이 꽤 다릅니다. 오늘도 쿠팡과 토스쇼핑 가격을 자동으로 비교해 차이가 큰 상품만 추렸습니다.",
  "쇼핑 전에 30초만 투자하세요. 오늘 기준으로 쿠팡과 토스쇼핑의 가격차가 큰 상품들을 정리했습니다.",
  "매일 아침 자동으로 두 플랫폼의 가격을 비교합니다. 오늘 가격 차이가 가장 크게 벌어진 상품들입니다.",
  "쿠폰과 프로모션에 따라 최저가는 매일 바뀝니다. 오늘의 승자는 어디일까요? 가격차 상위 상품을 모았습니다.",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug)).catch(() => null);
  if (!post) return { title: "리포트를 찾을 수 없어요" };
  const data = parse(post.content);
  const desc = data
    ? `오늘 가격차 1위: ${data.items[0]?.title?.slice(0, 40)} (${won(data.items[0]?.savings)} 차이). 쿠팡·토스쇼핑 실시간 최저가 비교.`
    : post.title;
  const url = `${SITE}/blog/${post.slug}`;
  return {
    title: post.title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: post.title, description: desc, url, type: "article", siteName: "입소문" },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug));
  if (!post) notFound();
  const data = parse(post.content);
  if (!data) notFound();

  const [y, m, d] = data.date.split("-").map(Number);
  const intro = INTROS[(y + m + d) % INTROS.length];
  const recent = (await getPosts(6)).filter((p) => p.slug !== post.slug).slice(0, 5);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    datePublished: new Date(post.createdAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: { "@type": "Organization", name: "입소문" },
    publisher: { "@type": "Organization", name: "입소문" },
    mainEntityOfPage: `${SITE}/blog/${post.slug}`,
  };

  return (
    <article className="post-article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="post-date">{`${y}년 ${m}월 ${d}일 · 자동 가격비교 리포트`}</p>
      <h1>{post.title}</h1>
      <p className="post-intro">{intro}</p>

      {data.lows && data.lows.length > 0 && (
        <div className="post-lows">
          <b>🔥 오늘 역대 최저가 진입</b>
          {data.lows.map((l) => (
            <Link key={l.slug} href={`/p/${l.slug}`}>
              {l.title.slice(0, 45)} — <b>{won(l.price ?? 0)}</b>
            </Link>
          ))}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="post-table">
          <thead>
            <tr>
              <th>#</th>
              <th>상품</th>
              <th>쿠팡</th>
              <th>토스쇼핑</th>
              <th>차액</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, i) => {
              const cheaper = it.toss < it.coupang ? "toss" : "coupang";
              return (
                <tr key={it.slug}>
                  <td>{i + 1}</td>
                  <td>
                    <Link href={`/p/${it.slug}`}>
                      <b>{it.title}</b>
                    </Link>
                    {it.rating != null && it.ratingCount != null && (
                      <span className="post-rating">
                        ⭐{it.rating} ({it.ratingCount.toLocaleString("ko-KR")})
                      </span>
                    )}
                  </td>
                  <td className={cheaper === "coupang" ? "win" : ""}>{won(it.coupang)}</td>
                  <td className={cheaper === "toss" ? "win" : ""}>{won(it.toss)}</td>
                  <td>
                    <b className={`diff ${cheaper}`}>
                      {cheaper === "toss" ? "토스" : "쿠팡"} {won(it.savings)}↓
                    </b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p>
        위 {data.items.length}개 상품의 가격차를 모두 합치면{" "}
        <b>{won(data.totalSavings)}</b>입니다. 상품명을 누르면 실시간 가격과 구매
        버튼이 있는 페이지로 이동합니다. 현재 사이트에서 비교 중인 상품은 총{" "}
        {data.totalCompare}개이며,{" "}
        <Link href="/compare" style={{ color: "#1c7ed6", fontWeight: 600 }}>
          전체 가격비교 페이지
        </Link>
        에서 한눈에 볼 수 있습니다.
      </p>

      <div className="disclosure">
        ※ 쿠폰 보유에 따라 가격 변동이 있습니다. 표시된 가격은 리포트 생성 시점
        기준입니다.
        <br />
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를
        제공받습니다. 또한 이 콘텐츠는 토스쇼핑 쉐어링크 활동의 일환으로, 링크를
        통한 구매가 발생하면 일정 수수료를 지급받습니다.
      </div>

      {recent.length > 0 && (
        <div className="post-more">
          <h2>지난 리포트</h2>
          {recent.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`}>
              {p.title}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
