import fs from "node:fs/promises";
import path from "node:path";

/**
 * 공유 미리보기 이미지(next/og)용 글꼴.
 * 저장소의 Pretendard 서브셋(assets/fonts) → OG_FONT_PATH(로컬 시험) → CDN 순.
 * 빌드 때 외부 CDN 접속이 실패해 기본 이미지로 대체된 적이 있어 저장소 글꼴을 먼저 쓴다.
 */
const FONT_URLS = [
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/public/static/Pretendard-Bold.otf",
];

const toAB = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

export async function loadOgFont(): Promise<ArrayBuffer | null> {
  for (const p of [path.join(process.cwd(), "assets", "fonts", "Pretendard-Bold.og.woff"), process.env.OG_FONT_PATH]) {
    if (!p) continue;
    try {
      return toAB(await fs.readFile(p));
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

/** 글꼴이 없을 때 — 한글이 깨진 이미지 대신 기본 이미지 */
export async function defaultOgImage(): Promise<Response> {
  const png = await fs.readFile(path.join(process.cwd(), "public", "og-default.png"));
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
}
