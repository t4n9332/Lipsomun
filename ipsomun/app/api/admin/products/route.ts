import { NextResponse } from "next/server";
import {
  adminListProducts,
  adminCountProducts,
  createProduct,
  updateProduct,
  type ProductInput,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/**
 * 제품 목록 조회 (토스 매칭 도구 등 외부 스크립트용)
 * ?limit=N&offset=M — 응답의 total로 잘림 여부를 알 수 있다.
 * 상한이 1,000이던 때 상품이 928개까지 차서, 넘는 순간 오래된 상품이 가격갱신·
 * 중복검사·초안 후보에서 조용히 빠질 뻔했다(2026-09-05). 상한을 넉넉히 올렸다.
 */
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 500), 20000);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  const [total, list] = await Promise.all([
    adminCountProducts(),
    adminListProducts(limit, offset),
  ]);
  const products = list.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    category: p.category,
    price: p.price,
    isPublished: p.isPublished,
    clicks: p.clicks,
    views: p.views,
    links: p.links.map((l) => ({
      platform: l.platform,
      url: l.url,
      price: l.price,
    })),
  }));
  return NextResponse.json({ products, total, limit, offset });
}

/** 제품 생성 (단건 또는 배열 일괄 등록) */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const inputs: ProductInput[] = Array.isArray(body) ? body : body ? [body] : [];
  if (inputs.length === 0 || inputs.some((p) => !p.title?.trim())) {
    return NextResponse.json(
      { error: "title이 있는 제품 데이터가 필요합니다" },
      { status: 400 }
    );
  }

  const created = [];
  for (const p of inputs.slice(0, 30)) {
    created.push(await createProduct(p));
  }

  revalidatePath("/");
  return NextResponse.json({ created: created.length, products: created });
}

/** 제품 수정 (링크는 전체 교체) */
export async function PUT(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  }
  const p: ProductInput = await req.json().catch(() => null);
  if (!p?.id || !p.title?.trim()) {
    return NextResponse.json({ error: "id와 title이 필요합니다" }, { status: 400 });
  }
  const product = await updateProduct(p);
  if (!product) {
    return NextResponse.json({ error: "제품을 찾을 수 없습니다" }, { status: 404 });
  }

  revalidatePath("/");
  revalidatePath(`/p/${product.slug}`);
  return NextResponse.json({ product });
}
