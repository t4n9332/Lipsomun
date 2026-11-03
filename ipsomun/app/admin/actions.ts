"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  deleteProduct,
  toggleProductField,
  recentLoginFailures,
  recordLoginFailure,
} from "@/lib/db";
import { isAdmin, login, logout } from "@/lib/auth";

/** 15분에 5번 틀리면 잠근다 — 무차별 대입 방지 */
const MAX_LOGIN_FAILURES = 5;

export async function loginAction(formData: FormData) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  if ((await recentLoginFailures(ip).catch(() => 0)) >= MAX_LOGIN_FAILURES) {
    redirect("/admin/login?error=locked");
  }
  const ok = await login(String(formData.get("password") || ""));
  if (!ok) {
    await recordLoginFailure(ip).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000)); // 실패마다 1초 지연
    redirect("/admin/login?error=1");
  }
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
