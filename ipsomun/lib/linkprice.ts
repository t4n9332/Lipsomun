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

/**
 * 상대·프로토콜상대 이미지 주소를 절대 주소로 바꾼다.
 * 네이버는 og:image를 "/images/icon/og_sell.jpg"처럼 상대 경로로 주는데,
 * 그대로 저장하면 우리 사이트 기준으로 해석돼 이미지가 깨진다.
 * baseUrl은 리다이렉트까지 따라간 최종 주소여야 한다.
 */
function absolutize(src: string, baseUrl: string): string {
  if (!src) return "";
  if (/^data:/i.test(src)) return "";
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return "";
  }
}

/** JSON-LD(Product)에서 제목·이미지·가격을 꺼낸다. 토스처럼 메타태그가 부족한 곳 대비 */
function pickJsonLd(html: string): { title: string; image: string; price: number | null } {
  const empty = { title: "", image: "", price: null as number | null };
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    // @graph 배열이나 최상위 배열로 오는 경우가 있다
    const list = Array.isArray(data)
      ? data
      : ((data as Record<string, unknown>)?.["@graph"] as unknown[]) || [data];
    for (const raw of list) {
      const node = raw as Record<string, unknown>;
      if (!node || typeof node !== "object") continue;
      const type = String(node["@type"] ?? "");
      if (!/product/i.test(type)) continue;
      const img = Array.isArray(node.image) ? node.image[0] : node.image;
      const offers = (Array.isArray(node.offers) ? node.offers[0] : node.offers) as
        | Record<string, unknown>
        | undefined;
      const rawPrice = offers?.price ?? offers?.lowPrice;
      const price = rawPrice != null ? Number(String(rawPrice).replace(/[^0-9.]/g, "")) || null : null;
      return {
        title: typeof node.name === "string" ? node.name : "",
        image: typeof img === "string" ? img : "",
        price,
      };
    }
  }
  return empty;
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

    // 리다이렉트를 따라간 최종 주소. 상대 경로 이미지를 여기 기준으로 푼다.
    const finalUrl = res.url || url;
    const ld = pickJsonLd(html);

    const title = decodeEntities(
      pickMeta(html, ["og:title", "twitter:title"]) ||
        ld.title ||
        (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "")
    );

    // og:image → twitter:image → JSON-LD → <link rel="image_src"> 순으로 찾고
    // 어느 쪽이든 절대 주소로 바꾼다.
    const rawImage =
      pickMeta(html, ["og:image", "og:image:url", "og:image:secure_url", "twitter:image"]) ||
      ld.image ||
      html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
      "";
    const imageUrl = absolutize(decodeEntities(rawImage), finalUrl);

    const priceRaw = pickMeta(html, [
      "product:price:amount",
      "og:price:amount",
      "product:sale_price:amount",
    ]);
    const price =
      (priceRaw ? Number(priceRaw.replace(/[^0-9]/g, "")) || null : null) ?? ld.price;
    const description = decodeEntities(
      pickMeta(html, ["og:description", "description"])
    ).slice(0, 200);

    return { title: title.slice(0, 200), imageUrl, price, description };
  } catch {
    return empty;
  }
}
