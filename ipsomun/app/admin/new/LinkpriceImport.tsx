"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, platformName } from "@/lib/util";

interface Draft {
  originalUrl: string;
  platform: string;
  affiliateUrl: string | null;
  linkError: string | null;
  title: string;
  imageUrl: string;
  price: number | null;
  description: string;
  // 편집용
  selected?: boolean;
}

export default function LinkpriceImport() {
  const [input, setInput] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [category, setCategory] = useState("기타");
  const [asDeal, setAsDeal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  async function importUrls() {
    const urls = input
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("http"));
    if (urls.length === 0) {
      setMsg({ ok: false, text: "상품 URL을 한 줄에 하나씩 붙여넣으세요." });
      return;
    }
    setBusy(true);
    setMsg(null);
    setDrafts([]);
    try {
      const res = await fetch("/api/admin/linkprice/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "가져오기 실패");
      const list: Draft[] = (data.drafts || []).map((d: Draft) => ({
        ...d,
        selected: !!d.affiliateUrl,
      }));
      setDrafts(list);
      const fail = list.filter((d) => !d.affiliateUrl).length;
      setMsg({
        ok: fail === 0,
        text:
          fail === 0
            ? `${list.length}개 상품의 제휴링크·정보를 가져왔습니다. 내용을 확인하고 등록하세요.`
            : `${list.length}개 중 ${fail}개는 제휴링크 변환에 실패했습니다 (해당 쇼핑몰 제휴 승인 여부 확인).`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "가져오기 실패" });
    } finally {
      setBusy(false);
    }
  }

  function patch(i: number, p: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...p } : d)));
  }

  async function register() {
    const chosen = drafts.filter((d) => d.selected && d.affiliateUrl);
    if (chosen.length === 0) {
      setMsg({ ok: false, text: "등록할 상품을 선택하세요." });
      return;
    }
    const noTitle = chosen.find((d) => !d.title.trim());
    if (noTitle) {
      setMsg({ ok: false, text: "제품명이 비어있는 상품이 있습니다. 채워주세요." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const payload = chosen.map((d) => ({
        title: d.title.trim(),
        description: d.description || "",
        imageUrl: d.imageUrl || "",
        price: d.price,
        category,
        isDeal: asDeal,
        links: [{ platform: d.platform, url: d.affiliateUrl as string }],
      }));
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "등록 실패");
      setMsg({ ok: true, text: `${data.created}개 제품이 등록되었습니다.` });
      setDrafts([]);
      setInput("");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "등록 실패" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card">
      <h2>🔗 링크프라이스로 자동 등록</h2>
      <p style={{ fontSize: 13.5, color: "#55524d", marginTop: 0 }}>
        제휴된 쇼핑몰(11번가, 오늘의집, G마켓, 옥션, SSG, 롯데온 등)의{" "}
        <b>상품 페이지 URL</b>을 한 줄에 하나씩 붙여넣으면, 링크프라이스 공식
        API로 <b>내 제휴링크(수익링크)</b>를 만들고 제품명·이미지·가격을 자동으로
        가져옵니다.
      </p>
      {msg && <div className={`notice ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

      <textarea
        rows={5}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={
          "https://www.11st.co.kr/products/...\nhttps://ohou.se/productions/...\nhttps://item.gmarket.co.kr/..."
        }
      />
      <div style={{ marginTop: 10 }}>
        <button className="btn" disabled={busy} onClick={importUrls}>
          {busy ? "가져오는 중..." : "제휴링크 만들기 + 상품정보 가져오기"}
        </button>
      </div>

      {drafts.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-end",
              marginTop: 20,
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
            <label style={{ display: "flex", gap: 6, alignItems: "center", margin: 0, paddingBottom: 8 }}>
              <input
                type="checkbox"
                checked={asDeal}
                onChange={(e) => setAsDeal(e.target.checked)}
              />
              오늘의 딜로 등록
            </label>
            <button
              className="btn"
              disabled={busy}
              onClick={register}
              style={{ marginLeft: "auto" }}
            >
              선택한 {drafts.filter((d) => d.selected && d.affiliateUrl).length}개
              등록
            </button>
          </div>

          {drafts.map((d, i) => (
            <div
              key={d.originalUrl + i}
              className="search-result-item"
              style={{
                alignItems: "flex-start",
                background: d.affiliateUrl
                  ? d.selected
                    ? "#fff1e8"
                    : "#fff"
                  : "#fdf0f0",
              }}
            >
              <input
                type="checkbox"
                checked={!!d.selected}
                disabled={!d.affiliateUrl}
                onChange={(e) => patch(i, { selected: e.target.checked })}
                style={{ width: 16, marginTop: 20 }}
              />
              {d.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.imageUrl} alt="" style={{ marginTop: 6 }} />
              ) : (
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 8,
                    background: "#f3f1ee",
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#8a867f", marginBottom: 4 }}>
                  {platformName(d.platform)} ·{" "}
                  {d.affiliateUrl ? (
                    <span style={{ color: "#2b8a3e" }}>제휴링크 생성됨 ✓</span>
                  ) : (
                    <span style={{ color: "#c92a2a" }}>{d.linkError}</span>
                  )}
                </div>
                <input
                  type="text"
                  value={d.title}
                  onChange={(e) => patch(i, { title: e.target.value })}
                  placeholder="제품명 (자동 추출 실패 시 직접 입력)"
                  style={{ marginBottom: 6 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={d.price ?? ""}
                    onChange={(e) =>
                      patch(i, {
                        price:
                          Number(e.target.value.replace(/[^0-9]/g, "")) || null,
                      })
                    }
                    placeholder="가격(원)"
                    style={{ width: 120 }}
                  />
                  <input
                    type="url"
                    value={d.imageUrl}
                    onChange={(e) => patch(i, { imageUrl: e.target.value })}
                    placeholder="이미지 URL"
                  />
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
