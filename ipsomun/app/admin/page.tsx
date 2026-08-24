import Link from "next/link";
import { redirect } from "next/navigation";
import {
  adminListProducts,
  adminStats,
  adminCategoryStats,
  adminTopProducts,
  adminPlatformStats,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { won, platformName, platformColor } from "@/lib/util";
import { deleteProductAction, toggleAction, logoutAction } from "./actions";
import GoldboxButton from "@/components/GoldboxButton";
import TossDealsButton from "@/components/TossDealsButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "관리자" };

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const [products, stats, catStats, topProducts, platformStats] = await Promise.all([
    adminListProducts(600),
    adminStats(),
    adminCategoryStats(),
    adminTopProducts(10),
    adminPlatformStats().catch(() => []),
  ]);

  return (
    <div className="admin-wrap" style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>📦 입소문 관리자</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <GoldboxButton />
          <TossDealsButton />
          <Link href="/admin/collections" className="btn secondary">
            🧺 기획전
          </Link>
          <Link href="/admin/new" className="btn">
            + 제품 등록
          </Link>
          <form action={logoutAction}>
            <button className="btn secondary" type="submit">
              로그아웃
            </button>
          </form>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="num">{products.length}</div>
          <div className="label">등록 제품</div>
        </div>
        <div className="stat">
          <div className="num">{stats.views.toLocaleString()}</div>
          <div className="label">총 조회수</div>
        </div>
        <div className="stat">
          <div className="num">{stats.clicks.toLocaleString()}</div>
          <div className="label">제휴링크 클릭</div>
        </div>
        <div className="stat">
          <div className="num">{products.filter((p) => p.isDeal).length}</div>
          <div className="label">오늘의 딜</div>
        </div>
      </div>

      {platformStats.length > 0 && (
        <div className="admin-card">
          <h2>🔗 플랫폼별 클릭 (수수료율: 토스 ~10% · 쿠팡 ~3%)</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>플랫폼</th>
                <th>링크 수</th>
                <th>클릭</th>
                <th>클릭 비중</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const totalClicks = platformStats.reduce((s, p) => s + p.clicks, 0);
                return platformStats.map((p) => (
                  <tr key={p.platform}>
                    <td>
                      <b style={{ fontSize: 13, color: platformColor(p.platform) }}>
                        {platformName(p.platform)}
                      </b>
                    </td>
                    <td>{p.links.toLocaleString()}</td>
                    <td><b>{p.clicks.toLocaleString()}</b></td>
                    <td>
                      {totalClicks > 0
                        ? ((p.clicks / totalClicks) * 100).toFixed(1) + "%"
                        : "—"}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: "#8a867f", margin: "10px 0 0" }}>
            같은 구매라면 토스(약 10%)가 쿠팡(약 3%)보다 수수료가 높습니다. 토스
            클릭 비중이 오를수록 수익 효율이 좋아져요.
          </p>
        </div>
      )}

      <div className="dash-2col">
        <div className="admin-card">
          <h2>📊 카테고리별 성과</h2>
          {catStats.every((c) => c.clicks === 0 && c.views === 0) ? (
            <div className="empty">아직 데이터가 쌓이는 중이에요.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>카테고리</th>
                  <th>제품</th>
                  <th>조회</th>
                  <th>클릭</th>
                  <th>클릭률</th>
                </tr>
              </thead>
              <tbody>
                {catStats.map((c) => (
                  <tr key={c.category}>
                    <td><b style={{ fontSize: 13 }}>{c.category}</b></td>
                    <td>{c.products}</td>
                    <td>{c.views.toLocaleString()}</td>
                    <td><b>{c.clicks.toLocaleString()}</b></td>
                    <td>{c.views > 0 ? ((c.clicks / c.views) * 100).toFixed(1) + "%" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ fontSize: 12, color: "#8a867f", margin: "10px 0 0" }}>
            클릭이 잘 나오는 카테고리에 제품을 더 등록하는 게 유리해요.
          </p>
        </div>

        <div className="admin-card">
          <h2>🔥 클릭 TOP 10</h2>
          {topProducts.length === 0 ? (
            <div className="empty">아직 클릭 데이터가 없어요.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>제품</th>
                  <th>클릭</th>
                  <th>조회</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td style={{ maxWidth: 260 }}>
                      <Link href={`/p/${p.slug}`} target="_blank">
                        <b style={{ fontSize: 13 }}>{p.title}</b>
                      </Link>
                      <div style={{ fontSize: 12, color: "#8a867f" }}>{p.category}</div>
                    </td>
                    <td><b>{p.clicks}</b></td>
                    <td>{p.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="admin-card">
        <h2>제품 목록</h2>
        {products.length === 0 ? (
          <div className="empty">
            등록된 제품이 없습니다. 위의 &lsquo;+ 제품 등록&rsquo;으로
            시작하세요.
          </div>
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
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" />
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
    </div>
  );
}
