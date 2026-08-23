"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, PLATFORMS } from "@/lib/util";

export interface FormLink {
  platform: string;
  url: string;
  price?: string;
}

export interface FormProduct {
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  price: string;
  originalPrice: string;
  isDeal: boolean;
  isPublished: boolean;
  review: string;
  pros: string;
  cons: string;
  rating: string;
  ratingCount: string;
  links: FormLink[];
}

export const emptyProduct: FormProduct = {
  title: "",
  description: "",
  imageUrl: "",
  category: "기타",
  price: "",
  originalPrice: "",
  isDeal: false,
  isPublished: true,
  review: "",
  pros: "",
  cons: "",
  rating: "",
  ratingCount: "",
  links: [{ platform: "coupang", url: "" }],
};

export default function ProductForm({ initial }: { initial: FormProduct }) {
  const [p, setP] = useState<FormProduct>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const isEdit = !!initial.id;

  function set<K extends keyof FormProduct>(key: K, value: FormProduct[K]) {
    setP((prev) => ({ ...prev, [key]: value }));
  }

  function setLink(i: number, patch: Partial<FormLink>) {
    setP((prev) => ({
      ...prev,
      links: prev.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));
  }

  async function convertLink(i: number) {
    const url = p.links[i]?.url?.trim();
    if (!url) return;
    const isCoupang = p.links[i].platform === "coupang";
    setBusy(true);
    setMsg(null);
    try {
      if (isCoupang) {
        const res = await fetch("/api/admin/coupang/deeplink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: [url] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "변환 실패");
        const short = data.links?.[0]?.shortenUrl;
        if (short) {
          setLink(i, { url: short });
          setMsg({ ok: true, text: "쿠팡 딥링크로 변환되었습니다: " + short });
        }
      } else {
        const res = await fetch("/api/admin/linkprice/deeplink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "변환 실패");
        setLink(i, { url: data.affiliateUrl });
        setMsg({
          ok: true,
          text: "링크프라이스 제휴링크로 변환되었습니다.",
        });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "변환 실패" });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!p.title.trim()) {
      setMsg({ ok: false, text: "제품명을 입력하세요." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        ...p,
        price: p.price ? Number(p.price.replace(/[^0-9]/g, "")) : null,
        originalPrice: p.originalPrice
          ? Number(p.originalPrice.replace(/[^0-9]/g, ""))
          : null,
        rating: p.rating
          ? Math.min(5, Math.max(0, Number(p.rating.replace(/[^0-9.]/g, "")))) || null
          : null,
        ratingCount: p.ratingCount
          ? Number(p.ratingCount.replace(/[^0-9]/g, "")) || null
          : null,
        links: p.links
          .filter((l) => l.url.trim())
          .map((l) => ({
            platform: l.platform,
            url: l.url,
            price: l.price ? Number(l.price.replace(/[^0-9]/g, "")) || null : null,
          })),
      };
      const res = await fetch("/api/admin/products", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      setMsg({ ok: true, text: "저장되었습니다." });
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "저장 실패" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card">
      <h2>{isEdit ? "✏️ 제품 수정" : "📝 제품 정보"}</h2>
      {msg && (
        <div className={`notice ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>
      )}

      <label>제품명 *</label>
      <input
        type="text"
        value={p.title}
        onChange={(e) => set("title", e.target.value)}
      />

      <label>한 줄 설명</label>
      <input
        type="text"
        value={p.description}
        onChange={(e) => set("description", e.target.value)}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label>카테고리</label>
          <select
            value={p.category}
            onChange={(e) => set("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label>판매가 (원)</label>
          <input
            type="text"
            value={p.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="29900"
          />
        </div>
        <div>
          <label>정가 (할인 전, 선택)</label>
          <input
            type="text"
            value={p.originalPrice}
            onChange={(e) => set("originalPrice", e.target.value)}
            placeholder="39900"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>⭐ 평점 (0~5, 선택)</label>
          <input
            type="text"
            value={p.rating}
            onChange={(e) => set("rating", e.target.value)}
            placeholder="4.5"
          />
        </div>
        <div>
          <label>리뷰 개수 (선택)</label>
          <input
            type="text"
            value={p.ratingCount}
            onChange={(e) => set("ratingCount", e.target.value)}
            placeholder="1234"
          />
        </div>
      </div>

      <label>이미지 URL</label>
      <input
        type="url"
        value={p.imageUrl}
        onChange={(e) => set("imageUrl", e.target.value)}
        placeholder="https://..."
      />

      <label>제휴 링크</label>
      {p.links.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select
            style={{ width: 130, flexShrink: 0 }}
            value={l.platform}
            onChange={(e) => setLink(i, { platform: e.target.value })}
          >
            {PLATFORMS.map((pl) => (
              <option key={pl.key} value={pl.key}>
                {pl.name}
              </option>
            ))}
          </select>
          <input
            type="url"
            value={l.url}
            onChange={(e) => setLink(i, { url: e.target.value })}
            placeholder={
              l.platform === "coupang"
                ? "쿠팡 상품 URL 붙여넣기 → 딥링크 변환"
                : "상품 URL 붙여넣기 → 제휴링크 변환 (링크프라이스)"
            }
          />
          <input
            type="text"
            style={{ width: 100, flexShrink: 0 }}
            value={l.price || ""}
            onChange={(e) => setLink(i, { price: e.target.value })}
            placeholder="가격(선택)"
          />
          <button
            className="btn secondary sm"
            type="button"
            disabled={busy}
            onClick={() => convertLink(i)}
            style={{ flexShrink: 0 }}
          >
            제휴링크 변환
          </button>
          <button
            className="btn danger sm"
            type="button"
            style={{ flexShrink: 0 }}
            onClick={() =>
              setP((prev) => ({
                ...prev,
                links: prev.links.filter((_, idx) => idx !== i),
              }))
            }
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="btn secondary sm"
        type="button"
        onClick={() =>
          setP((prev) => ({
            ...prev,
            links: [...prev.links, { platform: "naver", url: "" }],
          }))
        }
      >
        + 링크 추가
      </button>

      <label>리뷰 본문</label>
      <textarea
        rows={6}
        value={p.review}
        onChange={(e) => set("review", e.target.value)}
        placeholder="직접 써본 후기, 추천 이유 등을 자유롭게 적어주세요. 체류시간을 늘리는 핵심 콘텐츠입니다."
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>👍 장점 (줄바꿈으로 구분)</label>
          <textarea
            rows={4}
            value={p.pros}
            onChange={(e) => set("pros", e.target.value)}
          />
        </div>
        <div>
          <label>👎 단점 (줄바꿈으로 구분)</label>
          <textarea
            rows={4}
            value={p.cons}
            onChange={(e) => set("cons", e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, margin: "16px 0" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", margin: 0 }}>
          <input
            type="checkbox"
            checked={p.isDeal}
            onChange={(e) => set("isDeal", e.target.checked)}
          />
          오늘의 딜로 표시
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", margin: 0 }}>
          <input
            type="checkbox"
            checked={p.isPublished}
            onChange={(e) => set("isPublished", e.target.checked)}
          />
          사이트에 공개
        </label>
      </div>

      <button className="btn" disabled={busy} onClick={submit}>
        {busy ? "저장 중..." : isEdit ? "수정 저장" : "제품 등록"}
      </button>
    </div>
  );
}
