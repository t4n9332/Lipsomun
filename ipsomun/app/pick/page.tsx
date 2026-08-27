import Link from "next/link";
import Image from "next/image";
import { getPublishedCollections } from "@/lib/db";
import { imgUrl } from "@/lib/util";

export const revalidate = 1800; // 기획전 목록
export const metadata = {
  title: "기획전",
  description:
    "주제별로 골라 담은 추천 제품 모음. 상황과 예산에 맞는 제품을 한 번에 확인하세요.",
};

export default async function PickListPage() {
  const picks = await getPublishedCollections(50).catch(() => []);

  return (
    <section className="section">
      <div className="section-head">
        <h2>🧺 기획전</h2>
        <span className="sub">주제별로 골라 담은 추천 모음</span>
      </div>
      {picks.length === 0 ? (
        <div className="empty">첫 기획전을 준비하고 있어요. 곧 만나요!</div>
      ) : (
        <div className="pick-grid">
          {picks.map((c) => (
            <Link key={c.id} href={`/pick/${c.slug}`} className="pick-card">
              <span className="pick-thumbs">
                {c.images.slice(0, 4).map((img, i) => (
                  <span key={i} className="pt">
                    <Image src={imgUrl(img, 200)} alt="" fill sizes="80px" style={{ objectFit: "cover" }} />
                  </span>
                ))}
              </span>
              <span className="pick-info">
                <b>{c.title}</b>
                {c.description && <span className="d">{c.description}</span>}
                <span className="n">{c.itemCount}개 제품</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
