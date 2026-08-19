import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import NewProductClient from "./NewProductClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "제품 등록" };

export default async function NewProductPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <div className="admin-wrap">
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin" style={{ fontSize: 14, color: "#1c7ed6" }}>
          ← 관리자 홈
        </Link>
      </div>
      <NewProductClient />
    </div>
  );
}
