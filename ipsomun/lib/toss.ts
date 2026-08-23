/**
 * 토스쇼핑 쉐어링크(Sharelink) Open API 연동
 * - 토스쇼핑 상품을 사이트에 노출하고, 구매 시 수수료(약 10%)를 정산받는 공식 서버 API
 * - 문서: https://sharelink-docs.toss.im/guide/open-api.md
 *
 * 필요 환경변수:
 *   TOSS_SHARELINK_ACCESS_KEY   쉐어링크 크리에이터 어드민(sharelink.toss.im) > API 연동에서 발급
 *   TOSS_SHARELINK_SECRET_KEY   위와 동일 (발급 직후 1회만 표시되므로 즉시 보관)
 *   TOSS_SHARELINK_PUBLISHER_ID 퍼블리셔 UUID (인증 정보와 함께 안내됨)
 *
 * ⚠️ 출발지 IP 등록 필수: API를 호출하는 서버(Vercel 등)의 IP를
 *    쉐어링크 어드민에 등록해야 호출이 허용됩니다.
 */

const TOKEN_URL = "https://oauth2.cert.toss.im/token";
const BASE = "https://sharelink.toss.im/openapi";

export interface TossProduct {
  rank: number;
  tacaItemId: number;
  displayName: string;
  thumbnailUrl: string;
  productUrl: string; // 추적 안 되는 일반 링크 — 게시 금지
  displayPrice: number;
  originalPrice: number | null;
  discountRate: number | null;
  isSoldOut: boolean;
  reviewScore: number | null;
  reviewCount: number | null;
  categoryIds?: number[];
  endAt?: string; // 하루특가에만 존재 (특가 종료 시각)
}

export interface TossSharelink {
  tacaItemId: number;
  shortUrl: string; // 게시글에 넣을 수익 링크
  originUrl: string;
}

function configured(): boolean {
  return !!(
    process.env.TOSS_SHARELINK_ACCESS_KEY &&
    process.env.TOSS_SHARELINK_SECRET_KEY
  );
}

export function tossConfigured(): boolean {
  return configured();
}

/* ---------- 액세스 토큰 (약 1년 유효 — 전역 캐시 후 재사용) ---------- */

const tokenStore = globalThis as unknown as {
  __tossToken?: { token: string; expiresAt: number };
};

async function getToken(): Promise<string> {
  if (!configured()) {
    throw new Error(
      "토스 쉐어링크 API 키가 없습니다. 환경변수 TOSS_SHARELINK_ACCESS_KEY / TOSS_SHARELINK_SECRET_KEY를 등록하세요."
    );
  }
  const cached = tokenStore.__tossToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.TOSS_SHARELINK_ACCESS_KEY!,
    client_secret: process.env.TOSS_SHARELINK_SECRET_KEY!,
    scope: "sharelink:read sharelink:write",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`토스 토큰 발급 실패 (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text) as { access_token: string; expires_in: number };
  tokenStore.__tossToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };
  return data.access_token;
}

/* ---------- 공통 요청 ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tossRequest<T = any>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `토스 쉐어링크 API 오류 (${res.status}): ${text.slice(0, 300)}` +
        (res.status === 403
          ? " — 서버 출발지 IP가 쉐어링크 어드민에 등록되어 있는지 확인하세요."
          : "")
    );
  }
  const data = JSON.parse(text);
  if (data?.resultType !== "SUCCESS") {
    throw new Error(
      `토스 쉐어링크 API 실패: ${data?.error?.errorCode ?? "UNKNOWN"} ${
        data?.error?.reason ?? ""
      }`
    );
  }
  return data.success as T;
}

/* ---------- 조회 API ---------- */

/** 지금 많이 팔리는 상품 (카테고리 무관) */
export async function tossBestSelling(size = 20): Promise<TossProduct[]> {
  const s = await tossRequest<{ items: TossProduct[] }>(
    "GET",
    `/products/best-selling?size=${Math.min(Math.max(size, 1), 100)}`
  );
  return s.items ?? [];
}

/** 하루특가 (그날 하루만 판매, endAt 포함, 편성 없으면 0건) */
export async function tossTodayDeals(size = 30): Promise<TossProduct[]> {
  const s = await tossRequest<{ items: TossProduct[] }>(
    "GET",
    `/products/today-deals?size=${Math.min(Math.max(size, 1), 30)}`
  );
  return s.items ?? [];
}

/** 카테고리 베스트 상품 */
export async function tossBestCategory(
  categoryId: number,
  size = 20
): Promise<TossProduct[]> {
  const s = await tossRequest<{ items: TossProduct[] }>(
    "GET",
    `/products/best-categories/${categoryId}?size=${Math.min(Math.max(size, 1), 100)}`
  );
  return s.items ?? [];
}

export interface TossCategory {
  categoryId: number;
  displayName: string;
  children?: TossCategory[];
}

/** 토스쇼핑 카테고리 트리 */
export async function tossCategories(): Promise<TossCategory[]> {
  const s = await tossRequest<{ categories: TossCategory[] }>("GET", "/categories");
  return s.categories ?? [];
}

/* ---------- 쉐어링크 발급 ---------- */

/**
 * 수익 집계용 추적 링크(쉐어링크) 발급.
 * 같은 상품을 다시 요청하면 같은 링크가 반환되지만, 호출 한도를 아끼기 위해
 * 발급받은 링크는 DB에 저장해 재사용하세요.
 */
export async function createSharelink(tacaItemId: number): Promise<TossSharelink> {
  const publisherId = process.env.TOSS_SHARELINK_PUBLISHER_ID;
  if (!publisherId) {
    throw new Error(
      "환경변수 TOSS_SHARELINK_PUBLISHER_ID(퍼블리셔 UUID)가 설정되지 않았습니다."
    );
  }
  return tossRequest<TossSharelink>("POST", "/links", { tacaItemId, publisherId });
}
