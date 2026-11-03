"use client";

import { useEffect, useState } from "react";

export type Slide =
  | { kind: "intro" | "outro"; title: string; sub: string }
  | {
      kind: "buff" | "nerf";
      brand: string; brandId: string; name: string; img?: string;
      from?: string; to?: string; fromUnit?: number; toUnit?: number; pct: number;
    }
  | {
      kind: "versus"; name: string; img?: string;
      offers: { brand: string; brandId: string; t: string; unit: number }[];
    };

/** 슬라이드 하나당 노출 시간(ms). 쇼츠 60초 안에 들어오게 12장 × 3.5초 ≈ 42초 */
export const SLIDE_MS = 3500;
const won = (n?: number) => (n == null ? "" : n.toLocaleString("ko-KR") + "원");

/**
 * 9:16 전체화면 슬라이드쇼. 끝나면 window.__shortsDone = true (녹화 스크립트가 기다리는 신호).
 * ?i=3 으로 특정 장에서 멈춰 보기 가능(썸네일 캡처용).
 */
export default function CvsShorts({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);

  // 녹화 스크립트가 자막(SRT)·영상 설명을 만들 때 읽어간다
  useEffect(() => {
    (window as unknown as { __shortsSlides: Slide[] }).__shortsSlides = slides;
  }, [slides]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("i");
    if (p != null) {
      setI(Math.min(slides.length - 1, Number(p) || 0));
      setHold(true);
    }
  }, [slides.length]);

  useEffect(() => {
    if (hold) return;
    if (i >= slides.length - 1) {
      const t = setTimeout(() => ((window as unknown as { __shortsDone: boolean }).__shortsDone = true), SLIDE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((x) => x + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, hold, slides.length]);

  const s = slides[i];
  return (
    <div className="shorts-stage">
      <div className={`shorts-slide k-${s.kind}`} key={i}>
        <div className="shorts-progress">
          {slides.map((_, k) => (
            <span key={k} className={k < i ? "done" : k === i ? "now" : ""} />
          ))}
        </div>

        {(s.kind === "intro" || s.kind === "outro") && (
          <div className="shorts-center">
            {s.kind === "intro" && <div className="shorts-patch">PATCH NOTES</div>}
            <h1>{s.title}</h1>
            <p>{s.sub}</p>
          </div>
        )}

        {(s.kind === "buff" || s.kind === "nerf") && (
          <>
            <div className="shorts-verdict">{s.kind === "buff" ? "▲ BUFF" : "▼ NERF"}</div>
            <div className={`shorts-brand b-${s.brandId}`}>{s.brand}</div>
            <div className="shorts-img">{s.img ? <img src={s.img} alt="" /> : <span>🏪</span>}</div>
            <h2 className="shorts-name">{s.name}</h2>
            <div className="shorts-deal">
              <span className="old">{s.from}</span>
              <span className="arrow">→</span>
              <span className="new">{s.to}</span>
            </div>
            <div className="shorts-unit">
              1개당 {won(s.fromUnit)} → <b>{won(s.toUnit)}</b>
              <em>
                {s.pct > 0 ? "+" : ""}
                {Math.round(s.pct * 100)}%
              </em>
            </div>
          </>
        )}

        {s.kind === "versus" && (
          <>
            <div className="shorts-verdict vs">🆚 어디가 이득?</div>
            <div className="shorts-img">{s.img ? <img src={s.img} alt="" /> : <span>🏪</span>}</div>
            <h2 className="shorts-name">{s.name}</h2>
            <ol className="shorts-offers">
              {s.offers.map((o, k) => (
                <li key={o.brandId} className={k === 0 ? "win" : ""}>
                  <span className={`shorts-brand b-${o.brandId}`}>{o.brand}</span>
                  <b>{o.t}</b>
                  <span>1개당 {won(o.unit)}</span>
                  {k === 0 && <em>WIN</em>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
