/**
 * 편의점 행사 데이터 로더 (서버 전용).
 * data/cvs/*.json 은 매월 1일 GitHub Actions 가 갈아끼우고, 커밋되면 Vercel 이 다시 빌드한다.
 * 그래서 /cvs 페이지는 전부 정적(force-static) — DB 를 쓰지 않는다.
 */
import current from "@/data/cvs/current.json";
import previous from "@/data/cvs/previous.json";
import { crossBrand, diffMonths, type CvsMonth } from "@/lib/cvs";

export const CUR = current as CvsMonth;
export const PREV = previous as CvsMonth;
export const HAS_DATA = CUR.items.length > 0;
/** 지난달 데이터가 있어야 버프/너프를 낼 수 있다 (첫 달은 없음) */
export const HAS_PREV = PREV.items.length > 0 && PREV.month !== CUR.month;

export const CHANGES = HAS_PREV ? diffMonths(PREV.items, CUR.items) : [];
export const CROSS = crossBrand(CUR.items);
