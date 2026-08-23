/** 평점 별점 표시 (부분 채움 지원, 서버 컴포넌트) */
export default function Stars({
  rating,
  count,
  size = 13,
}: {
  rating: number;
  count?: number | null;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span className="stars" style={{ fontSize: size }}>
      <span className="stars-track" aria-hidden>
        <span className="stars-base">★★★★★</span>
        <span className="stars-fill" style={{ width: `${pct}%` }}>
          ★★★★★
        </span>
      </span>
      <span className="stars-num">{rating.toFixed(1)}</span>
      {count != null && count > 0 && (
        <span className="stars-count">({count.toLocaleString("ko-KR")})</span>
      )}
    </span>
  );
}
