import type { ReactNode } from "react";

/** 계산기 입력 칸 — 라벨 + 입력 + 단위. 계산기 8개가 같은 모양을 쓴다. */
export default function Field({
  label,
  unit,
  children,
}: {
  label: string;
  unit: string;
  children: ReactNode;
}) {
  return (
    <label className="calc-field">
      <span className="calc-label">{label}</span>
      <span className="calc-input">
        {children}
        {unit && <em>{unit}</em>}
      </span>
    </label>
  );
}
