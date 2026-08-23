import crypto from "crypto";

const DOMAIN = "https://api-gateway.coupang.com";

function hmacHeader(method: string, fullPath: string): string {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error(
      "쿠팡파트너스 API 키가 설정되지 않았습니다. 환경변수 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY를 등록하세요."
    );
  }

  const [path, query = ""] = fullPath.split("?");

  // signed-date: yyMMdd'T'HHmmss'Z' (GMT)
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const signedDate =
    String(now.getUTCFullYear()).slice(2) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    "T" +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    "Z";

  const message = signedDate + method + path + query;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("hex");

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

async function coupangRequest<T>(
  method: "GET" | "POST",
  fullPath: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(DOMAIN + fullPath, {
    method,
    headers: {
      Authorization: hmacHeader(method, fullPath),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`쿠팡 API 오류 (${res.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export interface CoupangDeeplink {
  originalUrl: string;
  shortenUrl: string;
  landingUrl: string;
}

/** 쿠팡 상품 URL 목록 → 제휴 딥링크로 일괄 변환 */
export async function createDeeplinks(urls: string[]): Promise<CoupangDeeplink[]> {
  const path = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
  const data = await coupangRequest<{ data: CoupangDeeplink[] }>("POST", path, {
    coupangUrls: urls,
    subId: process.env.COUPANG_SUB_ID || undefined,
  });
  return data.data;
}

export interface CoupangProduct {
  productId: number;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  categoryName?: string;
  isRocket?: boolean;
  isFreeShipping?: boolean;
}

/** 키워드로 쿠팡 상품 검색 (제휴링크 포함, 시간당 호출 제한 있음) */
export async function searchProducts(
  keyword: string,
  limit = 10
): Promise<CoupangProduct[]> {
  const path =
    "/v2/providers/affiliate_open_api/apis/openapi/products/search?keyword=" +
    encodeURIComponent(keyword) +
    "&limit=" +
    limit +
    (process.env.COUPANG_SUB_ID
      ? "&subId=" + encodeURIComponent(process.env.COUPANG_SUB_ID)
      : "");
  const data = await coupangRequest<{
    data: { productData: CoupangProduct[] };
  }>("GET", path);
  return data.data?.productData ?? [];
}

/** 카테고리별 베스트 상품 (categoryId: 쿠팡 문서 기준, 예: 1016=가전디지털) */
export async function bestCategoryProducts(
  categoryId: number,
  limit = 10
): Promise<CoupangProduct[]> {
  const path =
    `/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories/${categoryId}?limit=` +
    limit +
    (process.env.COUPANG_SUB_ID
      ? "&subId=" + encodeURIComponent(process.env.COUPANG_SUB_ID)
      : "");
  const data = await coupangRequest<{ data: CoupangProduct[] }>("GET", path);
  return data.data ?? [];
}

/** 골드박스(오늘의 특가) 상품 목록 */
export async function goldboxProducts(limit = 20): Promise<CoupangProduct[]> {
  const path =
    "/v2/providers/affiliate_open_api/apis/openapi/products/goldbox?limit=" +
    limit +
    (process.env.COUPANG_SUB_ID
      ? "&subId=" + encodeURIComponent(process.env.COUPANG_SUB_ID)
      : "");
  const data = await coupangRequest<{ data: CoupangProduct[] }>("GET", path);
  return data.data ?? [];
}
