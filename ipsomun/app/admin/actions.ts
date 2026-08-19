"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteProduct, toggleProductField } from "@/lib/db";
import { isAdmin, login, logout } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const ok = await login(String(formData.get("password") || ""));
  if (!ok) redirect("/admin/login?error=1");
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

async function guard() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function deleteProductAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id"));
  await deleteProduct(id);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function toggleAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id"));
  const field = String(formData.get("field"));
  if (field === "isDeal" || field === "isPublished") {
    await toggleProductField(id, field);
  }
  revalidatePath("/admin");
  revalidatePath("/");
}
