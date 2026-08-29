"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { won, platformName, imgUrl } from "@/lib/util";
import { deleteProductAction, toggleAction } from "./actions";

interface LinkRow {
  platform: string;
}

interface ProductRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  price: number;
  imageUrl: string;
  clicks: number;
  isDeal: boolean;
  isPublished: boolean;
  createdAt: string | Date;
  links: LinkRow[];
}

const RECENT_TAB = "__recent__";
const RECENT_COUNT = 5;

export default function ProductListTabs({ products }: { products: ProductRow[] }) {
  // 목록은 이미 최신순으로 넘어온다(관리자 페이지 쿼리가 created_at DESC).
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(p.category || "기타");
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [products]);

  const [tab, setTab] = useState<string>(RECENT_TAB);

  const shown = useMemo(() => {
    if (tab === RECENT_TAB) return products.slice(0, RECENT_COUNT);
    return products.filter((p) => (p.category || "기타") === tab);
  }, [products, tab]);

  return (
    <div className="admin-card">
      <h2>제품 목록</h2>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <button
          className={`btn sm ${tab === RECENT_TAB ? "" : "secondary"}`}
          onClick={() => setTab(RECENT_TAB)}
          type="button"
        >
          🆕 최근 등록
        </button>
        {categories.map((c) => {
          const count = products.filter((p) => (p.category || "기타") === c).length;
          return (
            <button
              key={c}
              className={`btn sm ${tab === c ? "" : "secondary"}`}
              onClick={() => setTab(c)}
              type="button"
            >
              {c} ({count})
            </button>
          );
        })}
      </div>

      {products.length === 0 ? (
        <div className="empty">
          등록된 제품이 없습니다. 위의 &lsquo;+ 제품 등록&rsquo;으로
          시작하세요.
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">해당 카테고리에 등록된 제품이 없습니다.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th></th>
                <th>제품</th>
                <th>가격</th>
                <th>링크</th>
                <th>클릭</th>
                <th>딜</th>
                <th>공개</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl(p.imageUrl, 60)} alt="" loading="lazy" />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    <Link href={`/p/${p.slug}`} target="_blank">
                      <b style={{ fontSize: 13.5 }}>{p.title}</b>
                    </Link>
                    <div style={{ fontSize: 12, color: "#8a867f" }}>
                      {p.category}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{won(p.price)}</td>
                  <td style={{ fontSize: 12 }}>
                    {p.links.map((l) => platformName(l.platform)).join(", ") ||
                      "—"}
                  </td>
                  <td>{p.clicks}</td>
                  <td>
                    <form action={toggleAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="field" value="isDeal" />
                      <button
                        className={`pill ${p.isDeal ? "on" : "off"}`}
                        style={{ border: "none", cursor: "pointer" }}
                        type="submit"
                      >
                        {p.isDeal ? "딜 ON" : "딜 OFF"}
                      </button>
                    </form>
                  </td>
                  <td>
                    <form action={toggleAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="field" value="isPublished" />
                      <button
                        className={`pill ${p.isPublished ? "on" : "off"}`}
                        style={{ border: "none", cursor: "pointer" }}
                        type="submit"
                      >
                        {p.isPublished ? "공개" : "비공개"}
                      </button>
                    </form>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link
                      href={`/admin/edit/${p.id}`}
                      className="btn secondary sm"
                      style={{ marginRight: 6 }}
                    >
                      수정
                    </Link>
                    <form action={deleteProductAction} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn danger sm" type="submit">
                        삭제
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
