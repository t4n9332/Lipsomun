"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GoldboxButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/cron/goldbox");
      const data = await res.json();
      setResult(data.message || data.error || "완료");
      router.refresh();
    } catch {
      setResult("실행 실패 — 네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button className="btn secondary" onClick={run} disabled={busy}>
        {busy ? "가져오는 중..." : "🎁 골드박스 지금 갱신"}
      </button>
      {result && (
        <span style={{ fontSize: 12.5, color: "#55524d", maxWidth: 260 }}>
          {result}
        </span>
      )}
    </span>
  );
}
