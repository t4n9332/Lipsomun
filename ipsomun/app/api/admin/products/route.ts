import { NextResponse } from "next/server";
import { createProduct, updateProduct, type ProductInput } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

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
