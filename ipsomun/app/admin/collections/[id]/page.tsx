import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCollectionById, adminListProducts } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { won } from "@/lib/util";
import { saveCollectionAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "기획전 편집" };

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;
  const col = await getCollectionById(id);
  if (!col) notFound();

  const products = await adminListProducts(500);
  const selected = new Set(col.productIds);
  const posOf = (pid: string) => {
    const i = col.productIds.indexOf(pid);
    return i >= 0 ? i + 1 : "";
  };
  // 선택된 제품이 위로 오도록 정렬
  const sorted = [...products].sort((a, b) => {
    const sa = selected.has(a.id) ? col.productIds.indexOf(a.id) : 10000 + b.clicks;
    const sb = selected.has(b.id) ? col.productIds.indexOf(b.id) : 10000 + a.clicks;
    return sa - sb;
  });

  return (
    <div className="admin-wrap" style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>🧺 기획전 편집</h1>
        <Link href="/admin/collections" className="btn secondary" style={{ marginLeft: "auto" }}>
          ← 목록
        </Link>
      </div>

      <form action={saveCollectionAction}>
        <input type="hidden" name="id" value={col.id} />
        <div className="admin-card">
          <div className="col-form">
            <input name="title" defaultValue={col.title} required maxLength={80} />
            <input
              name="description"
              defaultValue={col.description}
              placeholder="한 줄 소개"
              maxLength={200}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              <input type="checkbox" name="isPublished" defaultChecked={col.isPublished} />
              공개
            </label>
            <button className="btn" type="submit">
              저장
            </button>
          </div>
          <p style={{ fontSize: 12.5, color: "#8a867f", margin: "10px 0 0" }}>
            아래에서 담을 제품을 체크하세요. 순서 칸에 1, 2, 3… 을 넣으면 그 순서대로
            보여요 (비워두면 뒤쪽에 배치).
          </p>
        </div>

        <div className="admin-card">
          <h2>
            제품 선택 <span style={{ fontWeight: 400, fontSize: 13 }}>({col.productIds.length}개 담김)</span>
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>담기</th>
                  <th>순서</th>
                  <th>제품</th>
                  <th>가격</th>
                  <th>클릭</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        name="pid"
                        value={p.id}
                        defaultChecked={selected.has(p.id)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name={`pos_${p.id}`}
                        defaultValue={posOf(p.id)}
                        min={1}
                        max={99}
                        style={{ width: 54 }}
                      />
                    </td>
                    <td style={{ maxWidth: 340 }}>
                      <b style={{ fontSize: 13 }}>{p.title}</b>
                      <div style={{ fontSize: 12, color: "#8a867f" }}>
                        {p.category}
                        {!p.isPublished && " · 비공개(기획전에 안 보임)"}
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{won(p.price)}</td>
                    <td>{p.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn" type="submit">
              저장
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
