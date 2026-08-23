export interface Level {
  level: number;
  name: string;
  emoji: string;
  min: number; // 필요 누적 스탬프
}

export const LEVELS: Level[] = [
  { level: 1, name: "구경꾼", emoji: "👀", min: 1 },
  { level: 2, name: "단골손님", emoji: "🛍️", min: 7 },
  { level: 3, name: "알뜰헌터", emoji: "🎯", min: 30 },
  { level: 4, name: "딜마스터", emoji: "🏅", min: 90 },
  { level: 5, name: "입소문 전설", emoji: "👑", min: 200 },
];

export function levelOf(totalStamps: number): Level {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalStamps >= l.min) current = l;
  }
  return current;
}

export function nextLevel(totalStamps: number): Level | null {
  for (const l of LEVELS) {
    if (totalStamps < l.min) return l;
  }
  return null;
}
