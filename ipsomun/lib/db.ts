import { Pool } from "pg";
import crypto from "crypto";

/* ---------- 타입 ---------- */

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  imageUrl: string;
  category: string;
  price: number | null;
  originalPrice: number | null;
  isDeal: boolean;
  isPublished: boolean;
  rank: number;
  review: string;
  pros: string;
  cons: string;
  clicks: number;
  views: number;
  rating: number | null;
  ratingCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateLink {
  id: string;
  platform: string;
  url: string;
  clicks: number;
  price: number | null;
  productId: string;
}

export interface ProductWithLinks extends Product {
  links: AffiliateLink[];
}

export interface ProductInput {
  id?: string;
  title: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  price?: number | null;
  originalPrice?: number | null;
  isDeal?: boolean;
  isPublished?: boolean;
  rank?: number;
  review?: string;
  pros?: string;
  cons?: string;
  source?: string;
  rating?: number | null;
  ratingCount?: number | null;
  links?: { platform: string; url: string; price?: number | null }[];
}

/* ---------- 커넥션 & 스키마 ---------- */

const globalStore = globalThis as unknown as {
  __pgPool?: Pool;
  __schemaReady?: Promise<void>;
};

function pool(): Pool {
  if (!globalStore.__pgPool) {
    globalStore.__pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
    });
  }
  return globalStore.__pgPool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '기타',
  price INTEGER,
  original_price INTEGER,
  is_deal BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  review TEXT NOT NULL DEFAULT '',
  pros TEXT NOT NULL DEFAULT '',
  cons TEXT NOT NULL DEFAULT '',
  clicks INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1);
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_count INTEGER;
CREATE TABLE IF NOT EXISTS affiliate_links (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'etc',
  url TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE
);
ALTER TABLE affiliate_links ADD COLUMN IF NOT EXISTS price INTEGER;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_deal ON products(is_deal);
CREATE INDEX IF NOT EXISTS idx_links_product ON affiliate_links(product_id);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  picture TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS attendance (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE TABLE IF NOT EXISTS price_history (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  price INTEGER NOT NULL,
  PRIMARY KEY (product_id, day)
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);
`;

async function ready(): Promise<void> {
  if (!globalStore.__schemaReady) {
    globalStore.__schemaReady = pool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((e) => {
        globalStore.__schemaReady = undefined;
        throw e;
      });
  }
  return globalStore.__schemaReady;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const res = await pool().query(sql, params as never[]);
  return res.rows as T[];
}

/* ---------- 매핑 ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProduct(r: any): Product {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description,
    imageUrl: r.image_url,
    category: r.category,
    price: r.price,
    originalPrice: r.original_price,
    isDeal: r.is_deal,
    isPublished: r.is_published,
    rank: r.priority,
    review: r.review,
    pros: r.pros,
    cons: r.cons,
    clicks: r.clicks,
    views: r.views,
    rating: r.rating != null ? Number(r.rating) : null,
    ratingCount: r.rating_count != null ? Number(r.rating_count) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLink(r: any): AffiliateLink {
  return {
    id: r.id,
    platform: r.platform,
    url: r.url,
    clicks: r.clicks,
    price: r.price != null ? Number(r.price) : null,
    productId: r.product_id,
  };
}

/** 구매 버튼 표시 순서: 쿠팡 → 토스 → 나머지 (가격비교 배치용) */
const PLATFORM_ORDER: Record<string, number> = { coupang: 0, toss: 1 };

function sortLinks(links: AffiliateLink[]): AffiliateLink[] {
  return [...links].sort(
    (a, b) => (PLATFORM_ORDER[a.platform] ?? 9) - (PLATFORM_ORDER[b.platform] ?? 9)
  );
}

async function attachLinks(products: Product[]): Promise<ProductWithLinks[]> {
  if (products.length === 0) return [];
  const ids = products.map((p) => p.id);
  const rows = await q(
    `SELECT * FROM affiliate_links WHERE product_id = ANY($1)`,
    [ids]
  );
  const map = new Map<string, AffiliateLink[]>();
  for (const r of rows) {
    const l = rowToLink(r);
    const arr = map.get(l.productId) || [];
    arr.push(l);
    map.set(l.productId, arr);
  }
  return products.map((p) => ({ ...p, links: sortLinks(map.get(p.id) || []) }));
}

/* ---------- 공개 조회 ---------- */

export async function getDeals(limit = 8): Promise<Product[]> {
  const rows = await q(
    `SELECT * FROM products WHERE is_published AND is_deal
     ORDER BY priority DESC, updated_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map(rowToProduct);
}

export async function getPopular(limit = 5): Promise<Product[]> {
  const rows = await q(
    `SELECT * FROM products WHERE is_published
     ORDER BY clicks DESC, views DESC, updated_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map(rowToProduct);
}

export async function getRecentReviewed(limit = 4): Promise<Product[]> {
  const rows = await q(
    `SELECT * FROM products WHERE is_published AND review <> ''
     ORDER BY updated_at DESC LIMIT $1`,
    [limit]
  );
  return rows.map(rowToProduct);
}

export async function getByCategory(category: string, limit = 60): Promise<Product[]> {
  const rows = await q(
    `SELECT * FROM products WHERE is_published AND category = $1
     ORDER BY clicks DESC, updated_at DESC LIMIT $2`,
    [category, limit]
  );
  return rows.map(rowToProduct);
}

export type SearchSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "discount"
  | "rating";

const SORT_SQL: Record<SearchSort, string> = {
  relevance: "clicks DESC, views DESC",
  price_asc: "price ASC NULLS LAST",
  price_desc: "price DESC NULLS LAST",
  discount:
    "(CASE WHEN original_price > price THEN (original_price - price)::float / original_price ELSE 0 END) DESC",
  rating: "rating DESC NULLS LAST, rating_count DESC NULLS LAST",
};

export async function searchProductsDb(
  query: string,
  limit = 60,
  sort: SearchSort = "relevance",
  category?: string
): Promise<Product[]> {
  const orderBy = SORT_SQL[sort] || SORT_SQL.relevance;
  const params: unknown[] = [`%${query}%`];
  let where = `is_published AND (title ILIKE $1 OR description ILIKE $1 OR category ILIKE $1)`;
  if (category) {
    params.push(category);
    where += ` AND category = $${params.length}`;
  }
  params.push(limit);
  const rows = await q(
    `SELECT * FROM products WHERE ${where} ORDER BY ${orderBy} LIMIT $${params.length}`,
    params
  );
  return rows.map(rowToProduct);
}

/** 검색 자동완성 제안 (제목 위주, 클릭수 순) */
export async function suggestTitles(query: string, limit = 8): Promise<string[]> {
  if (!query) return [];
  const rows = await q<{ title: string }>(
    `SELECT title FROM products WHERE is_published AND title ILIKE $1
     ORDER BY clicks DESC, views DESC LIMIT $2`,
    [`%${query}%`, limit]
  );
  return rows.map((r) => r.title);
}

export async function getBySlug(slug: string): Promise<ProductWithLinks | null> {
  const rows = await q(`SELECT * FROM products WHERE slug = $1`, [slug]);
  if (rows.length === 0) return null;
  const [p] = await attachLinks([rowToProduct(rows[0])]);
  return p;
}

export async function getBySlugs(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  const rows = await q(
    `SELECT * FROM products WHERE is_published AND slug = ANY($1)`,
    [slugs]
  );
  return rows.map(rowToProduct);
}

export async function getRelated(
  category: string,
  excludeId: string,
  limit = 4
): Promise<Product[]> {
  const rows = await q(
    `SELECT * FROM products WHERE is_published AND category = $1 AND id <> $2
     ORDER BY clicks DESC LIMIT $3`,
    [category, excludeId, limit]
  );
  return rows.map(rowToProduct);
}

export async function getAllSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  const rows = await q(
    `SELECT slug, updated_at FROM products WHERE is_published LIMIT 5000`
  );
  return rows.map((r) => ({ slug: r.slug, updatedAt: r.updated_at }));
}

export async function incrementViews(id: string): Promise<void> {
  await q(`UPDATE products SET views = views + 1 WHERE id = $1`, [id]);
}

/* ---------- 클릭 트래킹 ---------- */

export async function getLink(id: string): Promise<AffiliateLink | null> {
  const rows = await q(`SELECT * FROM affiliate_links WHERE id = $1`, [id]);
  return rows.length ? rowToLink(rows[0]) : null;
}

export async function trackClick(linkId: string, productId: string): Promise<void> {
  await Promise.allSettled([
    q(`UPDATE affiliate_links SET clicks = clicks + 1 WHERE id = $1`, [linkId]),
    q(`UPDATE products SET clicks = clicks + 1 WHERE id = $1`, [productId]),
  ]);
}

/* ---------- 관리자 ---------- */

export async function adminListProducts(limit = 200): Promise<ProductWithLinks[]> {
  const rows = await q(
    `SELECT * FROM products ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return attachLinks(rows.map(rowToProduct));
}

export async function adminStats(): Promise<{ clicks: number; views: number }> {
  const rows = await q(
    `SELECT COALESCE(SUM(clicks),0)::int AS clicks, COALESCE(SUM(views),0)::int AS views FROM products`
  );
  return { clicks: rows[0]?.clicks ?? 0, views: rows[0]?.views ?? 0 };
}

export async function getById(id: string): Promise<ProductWithLinks | null> {
  const rows = await q(`SELECT * FROM products WHERE id = $1`, [id]);
  if (rows.length === 0) return null;
  const [p] = await attachLinks([rowToProduct(rows[0])]);
  return p;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "product";
}

async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let i = 1;
  // 최대 50회 시도
  while (i < 50) {
    const rows = await q(`SELECT id FROM products WHERE slug = $1`, [slug]);
    if (rows.length === 0 || rows[0].id === excludeId) return slug;
    slug = `${base}-${++i}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function cleanLinks(links?: { platform: string; url: string; price?: number | null }[]) {
  return (links || [])
    .filter((l) => l && typeof l.url === "string" && l.url.trim().startsWith("http"))
    .map((l) => ({
      platform: l.platform || "etc",
      url: l.url.trim(),
      price: typeof l.price === "number" && l.price > 0 ? Math.round(l.price) : null,
    }))
    .slice(0, 10);
}

async function insertLinks(
  productId: string,
  links: { platform: string; url: string; price?: number | null }[]
) {
  for (const l of links) {
    await q(
      `INSERT INTO affiliate_links (id, platform, url, price, product_id) VALUES ($1,$2,$3,$4,$5)`,
      [crypto.randomUUID(), l.platform, l.url, l.price ?? null, productId]
    );
  }
}

/**
 * 특정 플랫폼 링크를 상품에 추가/갱신 (같은 플랫폼 링크가 있으면 교체).
 * 토스 가격비교 매칭 도구에서 사용.
 */
export async function upsertLink(
  productId: string,
  platform: string,
  url: string,
  price?: number | null
): Promise<void> {
  await q(`DELETE FROM affiliate_links WHERE product_id = $1 AND platform = $2`, [
    productId,
    platform,
  ]);
  await q(
    `INSERT INTO affiliate_links (id, platform, url, price, product_id) VALUES ($1,$2,$3,$4,$5)`,
    [crypto.randomUUID(), platform, url.trim(), price ?? null, productId]
  );
  await q(`UPDATE products SET updated_at = now() WHERE id = $1`, [productId]);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const id = crypto.randomUUID();
  const slug = await uniqueSlug(input.title);
  const rows = await q(
    `INSERT INTO products
       (id, title, slug, description, image_url, category, price, original_price,
        is_deal, is_published, priority, review, pros, cons, source, rating, rating_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      id,
      input.title.trim(),
      slug,
      input.description || "",
      input.imageUrl || "",
      input.category || "기타",
      input.price ?? null,
      input.originalPrice ?? null,
      !!input.isDeal,
      input.isPublished !== false,
      input.rank ?? 0,
      input.review || "",
      input.pros || "",
      input.cons || "",
      input.source || "",
      input.rating ?? null,
      input.ratingCount ?? null,
    ]
  );
  await insertLinks(id, cleanLinks(input.links));
  return rowToProduct(rows[0]);
}

/* ---------- 골드박스 자동 등록 지원 ---------- */

/** 특정 source로 등록된 제품들의 '오늘의 딜' 표시를 일괄 해제 */
export async function unsetDealsBySource(source: string): Promise<number> {
  const rows = await q(
    `UPDATE products SET is_deal = FALSE, updated_at = now()
     WHERE source = $1 AND is_deal = TRUE RETURNING id`,
    [source]
  );
  return rows.length;
}

/** source+제목으로 기존 제품 찾기 (중복 등록 방지용) */
export async function findBySourceTitle(
  source: string,
  title: string
): Promise<Product | null> {
  const rows = await q(
    `SELECT * FROM products WHERE source = $1 AND title = $2 LIMIT 1`,
    [source, title]
  );
  return rows.length ? rowToProduct(rows[0]) : null;
}

/** 기존 제품을 다시 오늘의 딜로 올리고 가격·평점 갱신 */
export async function reviveDeal(
  id: string,
  price: number | null,
  extra?: {
    originalPrice?: number | null;
    rating?: number | null;
    ratingCount?: number | null;
  }
): Promise<void> {
  await q(
    `UPDATE products SET is_deal = TRUE,
       price = COALESCE($2, price),
       original_price = COALESCE($3, original_price),
       rating = COALESCE($4, rating),
       rating_count = COALESCE($5, rating_count),
       updated_at = now()
     WHERE id = $1`,
    [id, price, extra?.originalPrice ?? null, extra?.rating ?? null, extra?.ratingCount ?? null]
  );
}

export async function updateProduct(input: ProductInput): Promise<Product | null> {
  if (!input.id) return null;
  const existing = await getById(input.id);
  if (!existing) return null;
  const slug =
    existing.title === input.title.trim()
      ? existing.slug
      : await uniqueSlug(input.title, input.id);
  const rows = await q(
    `UPDATE products SET
       title=$2, slug=$3, description=$4, image_url=$5, category=$6,
       price=$7, original_price=$8, is_deal=$9, is_published=$10,
       priority=$11, review=$12, pros=$13, cons=$14,
       rating=$15, rating_count=$16, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      input.id,
      input.title.trim(),
      slug,
      input.description || "",
      input.imageUrl || "",
      input.category || "기타",
      input.price ?? null,
      input.originalPrice ?? null,
      !!input.isDeal,
      input.isPublished !== false,
      input.rank ?? 0,
      input.review || "",
      input.pros || "",
      input.cons || "",
      input.rating ?? null,
      input.ratingCount ?? null,
    ]
  );
  await q(`DELETE FROM affiliate_links WHERE product_id = $1`, [input.id]);
  await insertLinks(input.id, cleanLinks(input.links));
  return rowToProduct(rows[0]);
}

export async function deleteProduct(id: string): Promise<void> {
  await q(`DELETE FROM products WHERE id = $1`, [id]);
}

export async function toggleProductField(
  id: string,
  field: "isDeal" | "isPublished"
): Promise<void> {
  const col = field === "isDeal" ? "is_deal" : "is_published";
  await q(`UPDATE products SET ${col} = NOT ${col}, updated_at = now() WHERE id = $1`, [id]);
}

/* ---------- 회원 / 출석 / 푸시 ---------- */

export interface SiteUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export async function upsertUser(
  email: string,
  name: string,
  picture: string
): Promise<SiteUser> {
  const rows = await q(
    `INSERT INTO users (id, email, name, picture) VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO UPDATE SET name = $3, picture = $4
     RETURNING id, email, name, picture`,
    [crypto.randomUUID(), email, name, picture]
  );
  return rows[0];
}

export async function getUser(id: string): Promise<SiteUser | null> {
  const rows = await q(
    `SELECT id, email, name, picture FROM users WHERE id = $1`,
    [id]
  );
  return rows.length ? rows[0] : null;
}

/** 한국시간 기준 오늘 날짜 (YYYY-MM-DD) */
export function kstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 출석 도장 찍기. 이미 찍었으면 false */
export async function stampAttendance(userId: string): Promise<boolean> {
  const rows = await q(
    `INSERT INTO attendance (user_id, day) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING user_id`,
    [userId, kstToday()]
  );
  return rows.length > 0;
}

export interface AttendanceStats {
  total: number;
  streak: number;
  todayDone: boolean;
}

export async function getAttendanceStats(userId: string): Promise<AttendanceStats> {
  const rows = await q(
    `SELECT to_char(day, 'YYYY-MM-DD') AS d FROM attendance WHERE user_id = $1 ORDER BY day DESC LIMIT 400`,
    [userId]
  );
  const days: string[] = rows.map((r) => r.d);
  const today = kstToday();
  const todayDone = days.includes(today);

  // 연속 출석: 오늘(또는 어제)부터 거꾸로 연속된 날 수
  let streak = 0;
  const cursor = new Date(today + "T00:00:00Z");
  if (!todayDone) cursor.setUTCDate(cursor.getUTCDate() - 1);
  const set = new Set(days);
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return { total: days.length, streak, todayDone };
}

export async function savePushSubscription(
  sub: {
    endpoint: string;
    [k: string]: unknown;
  },
  userId?: string | null
): Promise<void> {
  await q(
    `INSERT INTO push_subscriptions (endpoint, data, user_id) VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET data = $2,
       user_id = COALESCE($3, push_subscriptions.user_id)`,
    [sub.endpoint, JSON.stringify(sub), userId ?? null]
  );
}

export async function getPushSubscriptionsByUsers(
  userIds: string[]
): Promise<{ endpoint: string; data: string; user_id: string }[]> {
  if (userIds.length === 0) return [];
  return q(
    `SELECT endpoint, data, user_id FROM push_subscriptions WHERE user_id = ANY($1) LIMIT 5000`,
    [userIds]
  );
}

export async function getPushSubscriptions(): Promise<
  { endpoint: string; data: string }[]
> {
  return q(`SELECT endpoint, data FROM push_subscriptions LIMIT 5000`);
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await q(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

/* ---------- 가격 히스토리 ---------- */

/** 오늘(KST) 기준 전 상품 가격 스냅샷 저장. 저장된 행 수 반환 */
export async function snapshotPrices(): Promise<number> {
  const rows = await q(
    `INSERT INTO price_history (product_id, day, price)
     SELECT id, $1::date, price FROM products WHERE price IS NOT NULL
     ON CONFLICT (product_id, day) DO UPDATE SET price = EXCLUDED.price
     RETURNING product_id`,
    [kstToday()]
  );
  return rows.length;
}

export interface PricePoint {
  day: string;
  price: number;
}

export async function getPriceHistory(
  productId: string,
  limit = 120
): Promise<PricePoint[]> {
  const rows = await q(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, price
     FROM price_history WHERE product_id = $1
     ORDER BY day DESC LIMIT $2`,
    [productId, limit]
  );
  return rows.reverse();
}

export interface PriceStats {
  minPrice: number;
  maxPrice: number;
  days: number;
}

export async function getPriceStats(productId: string): Promise<PriceStats | null> {
  const rows = await q(
    `SELECT MIN(price)::int AS min, MAX(price)::int AS max, COUNT(*)::int AS days
     FROM price_history WHERE product_id = $1`,
    [productId]
  );
  if (!rows.length || !rows[0].days) return null;
  return { minPrice: rows[0].min, maxPrice: rows[0].max, days: rows[0].days };
}

/** 찜한 상품 중 직전 스냅샷보다 가격이 내려간 것 (푸시용) */
export interface FavoriteDrop {
  userId: string;
  title: string;
  slug: string;
  price: number;
  prevPrice: number;
}

export async function getFavoritePriceDrops(): Promise<FavoriteDrop[]> {
  const rows = await q(
    `WITH prev AS (
       SELECT DISTINCT ON (product_id) product_id, price
       FROM price_history WHERE day < $1::date
       ORDER BY product_id, day DESC
     )
     SELECT f.user_id, p.title, p.slug, p.price, prev.price AS prev_price
     FROM favorites f
     JOIN products p ON p.id = f.product_id AND p.is_published AND p.price IS NOT NULL
     JOIN prev ON prev.product_id = p.id
     WHERE p.price < prev.price
     LIMIT 2000`,
    [kstToday()]
  );
  return rows
    .map((r) => ({
      userId: r.user_id,
      title: r.title,
      slug: r.slug,
      price: r.price,
      prevPrice: r.prev_price,
    }))
    // 소액 변동 스팸 방지: 3% 이상 또는 1,000원 이상 하락만
    .filter((d) => d.prevPrice - d.price >= Math.min(Math.max(500, d.prevPrice * 0.03), 30000) || d.prevPrice - d.price >= 1000);
}

/* ---------- 찜 (서버 저장) ---------- */

export async function getFavoriteSlugs(userId: string): Promise<string[]> {
  const rows = await q(
    `SELECT p.slug FROM favorites f JOIN products p ON p.id = f.product_id
     WHERE f.user_id = $1 ORDER BY f.created_at DESC LIMIT 500`,
    [userId]
  );
  return rows.map((r) => r.slug);
}

export async function setFavorite(
  userId: string,
  slug: string,
  on: boolean
): Promise<void> {
  if (on) {
    await q(
      `INSERT INTO favorites (user_id, product_id)
       SELECT $1, id FROM products WHERE slug = $2
       ON CONFLICT DO NOTHING`,
      [userId, slug]
    );
  } else {
    await q(
      `DELETE FROM favorites WHERE user_id = $1
       AND product_id IN (SELECT id FROM products WHERE slug = $2)`,
      [userId, slug]
    );
  }
}

/** 로컬 찜 목록을 계정에 병합 (기기→계정 동기화) */
export async function mergeFavorites(userId: string, slugs: string[]): Promise<void> {
  const clean = slugs.filter((s) => typeof s === "string" && s.length < 200).slice(0, 300);
  if (clean.length === 0) return;
  await q(
    `INSERT INTO favorites (user_id, product_id)
     SELECT $1, id FROM products WHERE slug = ANY($2)
     ON CONFLICT DO NOTHING`,
    [userId, clean]
  );
}

/* ---------- 기획전 (컬렉션) ---------- */

export interface Collection {
  id: string;
  slug: string;
  title: string;
  description: string;
  isPublished: boolean;
  updatedAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCollection(r: any): Collection {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    isPublished: r.is_published,
    updatedAt: r.updated_at,
  };
}

async function uniqueCollectionSlug(title: string, excludeId?: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "pick";
  let slug = base;
  let i = 1;
  while (i < 50) {
    const rows = await q(`SELECT id FROM collections WHERE slug = $1`, [slug]);
    if (rows.length === 0 || rows[0].id === excludeId) return slug;
    slug = `${base}-${++i}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function createCollection(
  title: string,
  description: string
): Promise<Collection> {
  const id = crypto.randomUUID();
  const slug = await uniqueCollectionSlug(title);
  const rows = await q(
    `INSERT INTO collections (id, slug, title, description) VALUES ($1,$2,$3,$4) RETURNING *`,
    [id, slug, title.trim(), description]
  );
  return rowToCollection(rows[0]);
}

export async function updateCollection(input: {
  id: string;
  title: string;
  description: string;
  isPublished: boolean;
  productIds: string[];
}): Promise<void> {
  const existing = await q(`SELECT * FROM collections WHERE id = $1`, [input.id]);
  if (!existing.length) return;
  const slug =
    existing[0].title === input.title.trim()
      ? existing[0].slug
      : await uniqueCollectionSlug(input.title, input.id);
  await q(
    `UPDATE collections SET title=$2, slug=$3, description=$4, is_published=$5, updated_at=now() WHERE id=$1`,
    [input.id, input.title.trim(), slug, input.description, input.isPublished]
  );
  await q(`DELETE FROM collection_items WHERE collection_id = $1`, [input.id]);
  for (let i = 0; i < input.productIds.length && i < 100; i++) {
    await q(
      `INSERT INTO collection_items (collection_id, product_id, position) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [input.id, input.productIds[i], i]
    );
  }
}

export async function deleteCollection(id: string): Promise<void> {
  await q(`DELETE FROM collections WHERE id = $1`, [id]);
}

export async function adminListCollections(): Promise<
  (Collection & { itemCount: number })[]
> {
  const rows = await q(
    `SELECT c.*, COALESCE(ci.n, 0)::int AS item_count
     FROM collections c
     LEFT JOIN (SELECT collection_id, COUNT(*) AS n FROM collection_items GROUP BY collection_id) ci
       ON ci.collection_id = c.id
     ORDER BY c.updated_at DESC LIMIT 100`
  );
  return rows.map((r) => ({ ...rowToCollection(r), itemCount: r.item_count }));
}

export async function getCollectionById(
  id: string
): Promise<(Collection & { productIds: string[] }) | null> {
  const rows = await q(`SELECT * FROM collections WHERE id = $1`, [id]);
  if (!rows.length) return null;
  const items = await q(
    `SELECT product_id FROM collection_items WHERE collection_id = $1 ORDER BY position`,
    [id]
  );
  return { ...rowToCollection(rows[0]), productIds: items.map((r) => r.product_id) };
}

export async function getPublishedCollections(
  limit = 30
): Promise<(Collection & { itemCount: number; images: string[] })[]> {
  const rows = await q(
    `SELECT c.*, COALESCE(ci.n, 0)::int AS item_count
     FROM collections c
     LEFT JOIN (SELECT collection_id, COUNT(*) AS n FROM collection_items GROUP BY collection_id) ci
       ON ci.collection_id = c.id
     WHERE c.is_published
     ORDER BY c.updated_at DESC LIMIT $1`,
    [limit]
  );
  const cols = rows.map((r) => ({ ...rowToCollection(r), itemCount: r.item_count as number, images: [] as string[] }));
  if (cols.length) {
    const imgs = await q(
      `SELECT DISTINCT ON (ci.collection_id, ci.position) ci.collection_id, p.image_url
       FROM collection_items ci JOIN products p ON p.id = ci.product_id AND p.is_published
       WHERE ci.collection_id = ANY($1) AND p.image_url <> ''
       ORDER BY ci.collection_id, ci.position LIMIT 400`,
      [cols.map((c) => c.id)]
    );
    for (const c of cols) {
      c.images = imgs
        .filter((r) => r.collection_id === c.id)
        .slice(0, 4)
        .map((r) => r.image_url);
    }
  }
  return cols;
}

export async function getCollectionBySlug(
  slug: string
): Promise<(Collection & { products: Product[] }) | null> {
  const rows = await q(
    `SELECT * FROM collections WHERE slug = $1 AND is_published`,
    [slug]
  );
  if (!rows.length) return null;
  const prods = await q(
    `SELECT p.* FROM collection_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.collection_id = $1 AND p.is_published
     ORDER BY ci.position LIMIT 100`,
    [rows[0].id]
  );
  return { ...rowToCollection(rows[0]), products: prods.map(rowToProduct) };
}

export async function getAllCollectionSlugs(): Promise<
  { slug: string; updatedAt: Date }[]
> {
  const rows = await q(
    `SELECT slug, updated_at FROM collections WHERE is_published LIMIT 500`
  );
  return rows.map((r) => ({ slug: r.slug, updatedAt: r.updated_at }));
}

/* ---------- 어드민 클릭 대시보드 ---------- */

export interface CategoryStat {
  category: string;
  products: number;
  views: number;
  clicks: number;
}

export async function adminCategoryStats(): Promise<CategoryStat[]> {
  const rows = await q(
    `SELECT category, COUNT(*)::int AS products,
            COALESCE(SUM(views),0)::int AS views, COALESCE(SUM(clicks),0)::int AS clicks
     FROM products GROUP BY category ORDER BY clicks DESC, views DESC`
  );
  return rows.map((r) => ({
    category: r.category,
    products: r.products,
    views: r.views,
    clicks: r.clicks,
  }));
}

export async function adminTopProducts(limit = 10): Promise<Product[]> {
  const rows = await q(
    `SELECT * FROM products WHERE clicks > 0 ORDER BY clicks DESC, views DESC LIMIT $1`,
    [limit]
  );
  return rows.map(rowToProduct);
}
