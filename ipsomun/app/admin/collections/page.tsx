import Link from "next/link";
import { redirect } from "next/navigation";
import { adminListCollections } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { createCollectionAction, deleteCollectionAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "기획전 관리" };

export default async function AdminCollectionsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const cols = await adminListCollections();

  return (
    <div className="admin-wrap" style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>🧺 기획전 관리</h1>
        <Link href="/admin" className="btn secondary" style={{ marginLeft: "auto" }}>
          ← 관리자 홈
        </Link>
      </div>

      <div className="admin-card">
        <h2>새 기획전 만들기</h2>
        <form action={createCollectionAction} className="col-form">
          <input
            name="title"
            placeholder="기획전 제목 (예: 자취 필수템 10선)"
            required
            maxLength={80}
          />
          <input
            name="description"
            placeholder="한 줄 소개 (예: 원룸 자취 시작할 때 진짜 필요한 것만 모았어요)"
            maxLength={200}
          />
          <button className="btn" type="submit">
            만들고 제품 담기 →
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>기획전 목록</h2>
        {cols.length === 0 ? (
          <div className="empty">아직 기획전이 없어요. 위에서 첫 기획전을 만들어보세요.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>제목</th>
                <th>제품 수</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cols.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b style={{ fontSize: 13.5 }}>{c.title}</b>
                    <div style={{ fontSize: 12, color: "#8a867f" }}>/pick/{c.slug}</div>
                  </td>
                  <td>{c.itemCount}</td>
                  <td>
                    <span className={`pill ${c.isPublished ? "on" : "off"}`}>
                      {c.isPublished ? "공개" : "비공개"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link
                      href={`/pick/${c.slug}`}
                      target="_blank"
                      className="btn secondary sm"
                      style={{ marginRight: 6 }}
                    >
                      보기
                    </Link>
                    <Link
                      href={`/admin/collections/${c.id}`}
                      className="btn secondary sm"
                      style={{ marginRight: 6 }}
                    >
                      수정
                    </Link>
                    <form action={deleteCollectionAction} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn danger sm" type="submit">
                        삭제
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
