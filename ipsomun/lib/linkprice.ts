/**
 * 링크프라이스(LinkPrice) 공식 딥링크 API 연동
 * - 제휴된 쇼핑몰(11번가, 오늘의집, G마켓, 옥션, SSG 등)의 상품 URL을
 *   내 어필리에이트 ID(a_id)가 포함된 수익 링크로 변환합니다.
 * - 문서: https://api.linkprice.com/ci/service/custom_link_xml
 */

const API = "https://api.linkprice.com/ci/service/custom_link_xml";

export interface LinkpriceResult {
  originalUrl: string;
  affiliateUrl: string | null;
  error?: string;
}

export async function createLinkpriceLink(url: string): Promise<LinkpriceResult> {
  const aId = process.env.LINKPRICE_AFFILIATE_ID;
  if (!aId) {
    return {
      originalUrl: url,
      affiliateUrl: null,
      error:
        "링크프라이스 어필리에이트 ID가 설정되지 않았습니다. 환경변수 LINKPRICE_AFFILIATE_ID를 등록하세요.",
    };
  }
  try {
    const apiUrl = `${API}?a_id=${encodeURIComponent(aId)}&url=${encodeURIComponent(
      url
    )}&mode=json`;
    const res = await fetch(apiUrl, { cache: "no-store" });
    const text = await res.text();
    const data = JSON.parse(text);
    if (data?.result === "S" && data?.url) {
      return { originalUrl: url, affiliateUrl: data.url as string };
    }
    return {
      originalUrl: url,
      affiliateUrl: null,
      error: `변환 실패 (result=${data?.result ?? "?"}) — 해당 쇼핑몰과 제휴 승인이 되어있는지 확인하세요.`,
    };
  } catch (e) {
    return {
      originalUrl: url,
      affiliateUrl: null,
      error: e instanceof Error ? e.message : "링크프라이스 API 호출 실패",
    };
  }
}

/* ---------- 쇼핑몰 도메인 → 플랫폼 키 ---------- */

const DOMAIN_MAP: [RegExp, string][] = [
  [/coupang\.com/, "coupang"],
  [/11st\.co\.kr/, "11st"],
  [/ohou\.se|오늘의집|todayhouse/, "ohouse"],
  [/toss/, "toss"],
  [/smartstore\.naver|shopping\.naver|brand\.naver/, "naver"],
  [/gmarket\.co\.kr/, "gmarket"],
  [/auction\.co\.kr/, "auction"],
  [/ssg\.com|emart\.ssg/, "ssg"],
  [/lotteon\.com/, "lotteon"],
  [/wemakeprice|wemep/, "wemakeprice"],
  [/tmon\.co\.kr/, "tmon"],
  [/musinsa\.com/, "musinsa"],
  [/oliveyoung\.co\.kr/, "oliveyoung"],
];

export function detectPlatform(url: string): string {
  for (const [re, key] of DOMAIN_MAP) {
    if (re.test(url)) return key;
  }
  return "etc";
}

/* ---------- 상품 페이지 메타(OG) 자동 추출 ---------- */

export interface ProductMeta {
  title: string;
  imageUrl: string;
  price: number | null;
  description: string;
}

function pickMeta(html: string, names: string[]): string {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`,
      "i"
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`,
      "i"
    );
    const m = html.match(re) || html.match(re2);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export async function fetchProductMeta(url: string): Promise<ProductMeta> {
  const empty: ProductMeta = { title: "", imageUrl: "", price: null, description: "" };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return empty;
    const html = (await res.text()).slice(0, 500_000);

    const title = decodeEntities(
      pickMeta(html, ["og:title", "twitter:title"]) ||
        (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "")
    );
    const imageUrl = pickMeta(html, ["og:image", "twitter:image"]);
    const priceRaw = pickMeta(html, [
      "product:price:amount",
      "og:price:amount",
      "product:sale_price:amount",
    ]);
    const price = priceRaw ? Number(priceRaw.replace(/[^0-9]/g, "")) || null : null;
    const description = decodeEntities(
      pickMeta(html, ["og:description", "description"])
    ).slice(0, 200);

    return { title: title.slice(0, 200), imageUrl, price, description };
  } catch {
    return empty;
  }
}
