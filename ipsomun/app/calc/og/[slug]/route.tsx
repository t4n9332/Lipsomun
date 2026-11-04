import { ImageResponse } from "next/og";
import { CALCULATORS, getCalc } from "@/lib/calculators";
import { loadOgFont, defaultOgImage } from "@/lib/ogFont";

/**
 * 계산기 공유 미리보기 이미지 (1200×630) — 단톡방·커뮤니티에 계산기 링크가 공유될 때 뜬다.
 * 계산기 제목을 '본제목 — 부제'로 나눠 크게 보여준다. 빌드 때 계산기마다 정적으로 만든다.
 */
export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() {
  return CALCULATORS.map((c) => ({ slug: c.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = getCalc(decodeURIComponent((await params).slug));
  const font = await loadOgFont();
  if (!c || !font) return defaultOgImage();
  const [main, sub = ""] = c.title.split(" — ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "60px 68px", background: "linear-gradient(135deg, #fff4e6 0%, #ffe8cc 100%)", color: "#1a1a1a",
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 34, color: "#e8590c" }}>{"입소문 생활 계산기"}</div>
          <div
            style={{
              display: "flex", fontSize: 26, padding: "6px 16px", borderRadius: 999,
              background: "#e8590c", color: "#fff",
            }}
          >
            {c.group}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: main.length > 18 ? 70 : 84, lineHeight: 1.15 }}>{main}</div>
          {sub && (
            <div style={{ display: "flex", fontSize: 40, marginTop: 20, color: "#6b4a2e" }}>{sub}</div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#8a6a4f" }}>{"lipsomun.co.kr · 2026년 기준 · 무료"}</div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: "Pretendard", data: font, weight: 700, style: "normal" }] }
  );
}
