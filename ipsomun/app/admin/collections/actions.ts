"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCollection,
  updateCollection,
  deleteCollection,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";

async function guard() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function createCollectionAction(formData: FormData) {
  await guard();
  const title = String(formData.get("title") || "").trim();
  if (!title) redirect("/admin/collections");
  const col = await createCollection(
    title,
    String(formData.get("description") || "").trim()
  );
  revalidatePath("/admin/collections");
  redirect(`/admin/collections/${col.id}`);
}

export async function saveCollectionAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  if (!id || !title) redirect("/admin/collections");

  // 체크된 제품 + 순서값 → 순서 오름차순 정렬
  const ids = formData.getAll("pid").map(String);
  const withPos = ids.map((pid) => {
    const raw = Number(formData.get(`pos_${pid}`));
    return { pid, pos: Number.isFinite(raw) && raw > 0 ? raw : 999 };
  });
  withPos.sort((a, b) => a.pos - b.pos);

  await updateCollection({
    id,
    title,
    description: String(formData.get("description") || "").trim(),
    isPublished: formData.get("isPublished") === "on",
    productIds: withPos.map((w) => w.pid),
  });
  revalidatePath("/admin/collections");
  revalidatePath("/pick");
  revalidatePath("/");
  redirect("/admin/collections?saved=1");
}

export async function deleteCollectionAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  if (id) await deleteCollection(id);
  revalidatePath("/admin/collections");
  revalidatePath("/pick");
  redirect("/admin/collections");
}
