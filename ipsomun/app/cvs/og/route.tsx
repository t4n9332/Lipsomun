import { ImageResponse } from "next/og";
import fs from "node:fs/promises";
import path from "node:path";
import { brandName, monthLabel, unitPrice } from "@/lib/cvs";
import { CUR, CROSS, HAS_DATA, HAS_PREV, CHANGES } from "@/lib/cvsData";

/**
 * 편의점 행사 공유 미리보기 이미지 (1200×630) — 텔레그램·카톡에 링크를 올릴 때 뜬다.
 * 기본 로고 대신 '이번 달 숫자'가 보이면 클릭률이 오른다. 데이터가 바뀌는 매월 빌드 때 다시 만든다.
 *
 * 글꼴: 저장소의 Pretendard 서브셋(assets/fonts) → 없으면 CDN → 그래도 없으면 기본 이미지로.
 * 로컬 시험은 OG_FONT_PATH 로 TTF/OTF 경로를 줄 수 있다.
 */
export const dynamic = "force-static";

const FONT_URLS = [
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/public/static/Pretendard-Bold.otf",
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/woff/Pretendard-Bold.woff",
];

async function loadFont(): Promise<ArrayBuffer | null> {
  // 1순위: 저장소에 포함한 서브셋 글꼴 (빌드 때 외부 CDN 접속이 실패해 기본 이미지로 대체된 적이 있다)
  try {
    const b = await fs.readFile(path.join(process.cwd(), "assets", "fonts", "Pretendard-Bold.og.woff"));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  } catch {}
  if (process.env.OG_FONT_PATH) {
    try {
      const b = await fs.readFile(process.env.OG_FONT_PATH);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    } catch {}
  }
  for (const u of FONT_URLS) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15_000) });
      if (r.ok) return await r.arrayBuffer();
    } catch {}
  }
  return null;
}

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

export async function GET() {
  const font = await loadFont();
  if (!font || !HAS_DATA) {
    // 글꼴이 없으면 한글이 깨진 이미지를 내보내느니 기본 이미지를 준다
    const png = await fs.readFile(path.join(process.cwd(), "public", "og-default.png"));
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
  }

  const M = monthLabel(CUR.month);
  const best = CROSS.find((x) => x.save > 0);
  const buffs = HAS_PREV ? CHANGES.filter((c) => c.kind === "buff" && c.typeChanged).length : 0;
  const brands = Array.from(new Set(CUR.items.map((x) => x.b))).map(brandName).join(" · ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "56px 64px", background: "linear-gradient(135deg, #1b1f3a 0%, #0b0d17 100%)", color: "#fff",
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, color: "#ffd43b" }}>
          입소문 · 편의점 행사
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 86, lineHeight: 1.1 }}>{`${M} 편의점 1+1·2+1`}</div>
          <div style={{ display: "flex", fontSize: 38, marginTop: 18, color: "#c9d1ff" }}>
            {`${brands} · ${CUR.items.length.toLocaleString("ko-KR")}개${buffs > 0 ? ` · 버프 ${buffs}개` : ""}`}
          </div>
        </div>
        {best ? (
          <div
            style={{
              display: "flex", flexDirection: "column", padding: "22px 28px", borderRadius: 22,
              background: "rgba(255,212,59,0.14)", border: "3px solid #ffd43b",
            }}
          >
            <div style={{ display: "flex", fontSize: 30, color: "#ffd43b" }}>{`같은 상품, 어디가 이득? (${CROSS.length}개 비교)`}</div>
            <div style={{ display: "flex", fontSize: 40, marginTop: 8 }}>
              {`${best.name.slice(0, 22)} — ${brandName(best.offers[0].b)} ${best.offers[0].t} 1개당 ${won(unitPrice(best.offers[0]))}`}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <div style={{ display: "flex", fontSize: 30, color: "#9aa3c7" }}>lipsomun.co.kr/cvs · 매월 1일 갱신</div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: "Pretendard", data: font, weight: 700, style: "normal" }] }
  );
}
