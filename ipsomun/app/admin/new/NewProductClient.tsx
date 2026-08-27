"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductForm, { emptyProduct } from "@/components/ProductForm";
import LinkpriceImport from "./LinkpriceImport";
import { CATEGORIES } from "@/lib/util";

interface CoupangResult {
  productId: number;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  isRocket?: boolean;
}

export default function NewProductClient() {
  const [tab, setTab] = useState<"auto" | "naver" | "linkprice" | "manual">("auto");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<CoupangResult[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [category, setCategory] = useState("기타");
  const [asDeal, setAsDeal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  async function search() {
    if (!keyword.trim()) return;
    setBusy(true);
    setMsg(null);
    setResults([]);
    setSelected(new Set());
    try {
      const res = await fetch(
        "/api/admin/coupang/search?keyword=" + encodeURIComponent(keyword.trim())
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "검색 실패");
      setResults(data.products || []);
      if ((data.products || []).length === 0) {
        setMsg({ ok: false, text: "검색 결과가 없습니다." });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "검색 실패" });
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function registerSelected() {
    const chosen = results.filter((r) => selected.has(r.productId));
    if (chosen.length === 0) {
      setMsg({ ok: false, text: "등록할 제품을 선택하세요." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const payload = chosen.map((r) => ({
        title: r.productName,
        imageUrl: r.productImage,
        price: r.productPrice,
        category,
        isDeal: asDeal,
        links: [{ platform: "coupang", url: r.productUrl }],
      }));
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "등록 실패");
      setMsg({ ok: true, text: `${data.created}개 제품이 등록되었습니다.` });
      setResults([]);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "등록 실패" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button
          className={`btn ${tab === "auto" ? "" : "secondary"}`}
          onClick={() => setTab("auto")}
        >
          ⚡ 쿠팡 자동 등록
        </button>
        <button
          className={`btn ${tab === "naver" ? "" : "secondary"}`}
          onClick={() => setTab("naver")}
        >
          🟢 네이버 브랜드커넥트
        </button>
        <button
          className={`btn ${tab === "linkprice" ? "" : "secondary"}`}
          onClick={() => setTab("linkprice")}
        >
          🔗 링크프라이스 자동 등록
        </button>
        <button
          className={`btn ${tab === "manual" ? "" : "secondary"}`}
          onClick={() => setTab("manual")}
        >
          ✍️ 직접 등록
        </button>
      </div>

      {tab === "naver" ? (
        <LinkpriceImport
          mode="asis"
          platform="naver"
          heading="🟢 네이버 브랜드커넥트 상품 등록"
          guide={
            <>
              브랜드커넥트{" "}
              <a
                href="https://brandconnect.naver.com"
                target="_blank"
                rel="noopener"
                style={{ color: "#03c75a", fontWeight: 700 }}
              >
                제휴 상품 페이지
              </a>
              에서 <b>발급받은 제휴링크</b>를 한 줄에 하나씩 붙여넣으세요. 이미
              수익이 붙은 링크이므로 <b>그대로 사용</b>하고(재변환하지 않습니다),
              제품명·이미지·가격만 자동으로 가져옵니다. 한 번에 최대 15개.
            </>
          }
          placeholder={"브랜드커넥트에서 복사한 제휴링크를 한 줄에 하나씩\n(예: https://... )"}
          actionLabel="상품정보 가져오기"
        />
      ) : tab === "linkprice" ? (
        <LinkpriceImport />
      ) : tab === "auto" ? (
        <div className="admin-card">
          <h2>⚡ 키워드로 쿠팡 상품 자동 등록</h2>
          <p style={{ fontSize: 13.5, color: "#55524d", marginTop: 0 }}>
            키워드를 검색하면 쿠팡파트너스 API가 제품명·이미지·가격·제휴링크를
            자동으로 가져옵니다. 등록할 제품을 선택만 하면 끝!
            <br />
            <span style={{ color: "#8a867f" }}>
              ※ 쿠팡 검색 API는 시간당 호출 횟수 제한이 있으니 필요한 만큼만
              검색하세요.
            </span>
          </p>
          {msg && (
            <div className={`notice ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="예: 무선 청소기, 캠핑 의자, 에어프라이어..."
            />
            <button className="btn" disabled={busy} onClick={search} style={{ flexShrink: 0 }}>
              {busy ? "검색 중..." : "쿠팡 검색"}
            </button>
          </div>

          {results.length > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  marginTop: 18,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <label style={{ margin: "0 0 4px" }}>카테고리 지정</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ width: 160 }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <label
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    margin: "18px 0 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={asDeal}
                    onChange={(e) => setAsDeal(e.target.checked)}
                  />
                  오늘의 딜로 등록
                </label>
                <button
                  className="btn"
                  disabled={busy || selected.size === 0}
                  onClick={registerSelected}
                  style={{ marginLeft: "auto", marginTop: 14 }}
                >
                  선택한 {selected.size}개 등록
                </button>
              </div>

              {results.map((r) => (
                <div
                  key={r.productId}
                  className="search-result-item"
                  style={{
                    cursor: "pointer",
                    background: selected.has(r.productId) ? "#fff1e8" : "#fff",
                    borderColor: selected.has(r.productId)
                      ? "#e8590c"
                      : undefined,
                  }}
                  onClick={() => toggle(r.productId)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.productId)}
                    readOnly
                    style={{ width: 16 }}
                  />
                  {r.productImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.productImage} alt="" />
                  )}
                  <div className="t">
                    {r.productName}
                    {r.isRocket && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#1c7ed6",
                          marginLeft: 6,
                        }}
                      >
                        🚀로켓
                      </span>
                    )}
                    <div style={{ fontWeight: 800, marginTop: 2 }}>
                      {r.productPrice?.toLocaleString()}원
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <ProductForm initial={emptyProduct} />
      )}
    </>
  );
}
