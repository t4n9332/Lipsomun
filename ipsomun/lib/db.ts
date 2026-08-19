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
  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateLink {
  id: string;
  platform: string;
  url: string;
  clicks: number;
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
  links?: { platform: string; url: string }[];
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS affiliate_links (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'etc',
  url TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_deal ON products(is_deal);
CREATE INDEX IF NOT EXISTS idx_links_product ON affiliate_links(product_id);
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
    productId: r.product_id,
  };
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
  return products.map((p) => ({ ...p, links: map.get(p.id) || [] }));
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

export async function searchProductsDb(query: string, limit = 60): Promise<Product[]> {
  const rows = await q(
    `SELECT * FROM products WHERE is_published AND
       (title ILIKE $1 OR description ILIKE $1 OR category ILIKE $1)
     ORDER BY clicks DESC LIMIT $2`,
    [`%${query}%`, limit]
  );
  return rows.map(rowToProduct);
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

function cleanLinks(links?: { platform: string; url: string }[]) {
  return (links || [])
    .filter((l) => l && typeof l.url === "string" && l.url.trim().startsWith("http"))
    .map((l) => ({ platform: l.platform || "etc", url: l.url.trim() }))
    .slice(0, 10);
}

async function insertLinks(
  productId: string,
  links: { platform: string; url: string }[]
) {
  for (const l of links) {
    await q(
      `INSERT INTO affiliate_links (id, platform, url, product_id) VALUES ($1,$2,$3,$4)`,
      [crypto.randomUUID(), l.platform, l.url, productId]
    );
  }
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const id = crypto.randomUUID();
  const slug = await uniqueSlug(input.title);
  const rows = await q(
    `INSERT INTO products
       (id, title, slug, description, image_url, category, price, original_price,
        is_deal, is_published, priority, review, pros, cons)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
    ]
  );
  await insertLinks(id, cleanLinks(input.links));
  return rowToProduct(rows[0]);
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
       priority=$11, review=$12, pros=$13, cons=$14, updated_at=now()
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
