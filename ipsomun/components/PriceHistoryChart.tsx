import { PricePoint } from "@/lib/db";
import { won } from "@/lib/util";

/**
 * 가격 추이 미니 차트 (서버 렌더 SVG, 단일 시리즈 — 범례 불필요)
 * 매일 아침 크론이 저장하는 스냅샷 기반.
 */
export default function PriceHistoryChart({
  history,
  isAllTimeLow,
}: {
  history: PricePoint[];
  isAllTimeLow: boolean;
}) {
  if (history.length < 2) return null;

  const W = 600;
  const H = 150;
  const PAD_X = 8;
  const PAD_TOP = 26;
  const PAD_BOT = 22;

  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(max - min, Math.round(max * 0.02) || 1);
  const lo = min - span * 0.12;
  const hi = max + span * 0.12;

  const x = (i: number) =>
    PAD_X + (i / (history.length - 1)) * (W - PAD_X * 2);
  const y = (v: number) =>
    PAD_TOP + (1 - (v - lo) / (hi - lo)) * (H - PAD_TOP - PAD_BOT);

  const pts = history.map((p, i) => `${x(i).toFixed(1)},${y(p.price).toFixed(1)}`);
  const line = pts.join(" ");
  const area = `${PAD_X},${H - PAD_BOT} ${line} ${(W - PAD_X).toFixed(1)},${H - PAD_BOT}`;

  const minIdx = prices.indexOf(min);
  const maxIdx = prices.indexOf(max);
  const last = history[history.length - 1];
  const fmtDay = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

  // 라벨이 차트 밖으로 나가지 않게 좌우 여백 보정
  const anchorFor = (i: number) =>
    x(i) < 70 ? "start" : x(i) > W - 70 ? "end" : "middle";

  return (
    <div className="price-history">
      <div className="ph-head">
        <h2>📉 가격 추이</h2>
        <span className="sub">
          최근 {history.length}일 · 매일 아침 자동 기록
        </span>
        {isAllTimeLow && <span className="low-badge">역대 최저가</span>}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`최근 ${history.length}일 가격 추이. 최저 ${won(min)}, 최고 ${won(max)}, 현재 ${won(last.price)}.`}
        preserveAspectRatio="none"
        className="ph-svg"
      >
        <polygon points={area} fill="#e8590c" opacity="0.08" />
        <polyline
          points={line}
          fill="none"
          stroke="#e8590c"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* 최저/최고/현재 포인트와 라벨 (선별 직접 라벨) */}
        <circle cx={x(minIdx)} cy={y(min)} r="3.5" fill="#e8590c" stroke="#fff" strokeWidth="1.5">
          <title>{`${fmtDay(history[minIdx].day)} 최저 ${won(min)}`}</title>
        </circle>
        <text x={x(minIdx)} y={H - 6} textAnchor={anchorFor(minIdx)} className="ph-label">
          최저 {won(min)}
        </text>
        {maxIdx !== minIdx && (
          <>
            <circle cx={x(maxIdx)} cy={y(max)} r="3" fill="#b3aea5" stroke="#fff" strokeWidth="1.5">
              <title>{`${fmtDay(history[maxIdx].day)} 최고 ${won(max)}`}</title>
            </circle>
            <text x={x(maxIdx)} y={16} textAnchor={anchorFor(maxIdx)} className="ph-label muted">
              최고 {won(max)}
            </text>
          </>
        )}
        <circle
          cx={x(history.length - 1)}
          cy={y(last.price)}
          r="4"
          fill="#1a1a1a"
          stroke="#fff"
          strokeWidth="1.5"
        >
          <title>{`오늘 ${won(last.price)}`}</title>
        </circle>
      </svg>
      <div className="ph-range">
        <span>{fmtDay(history[0].day)}</span>
        <span>{fmtDay(last.day)}</span>
      </div>
    </div>
  );
}
