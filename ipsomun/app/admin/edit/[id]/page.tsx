import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getById } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import ProductForm from "@/components/ProductForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "제품 수정" };

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;
  const product = await getById(id);
  if (!product) notFound();

  return (
    <div className="admin-wrap">
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin" style={{ fontSize: 14, color: "#1c7ed6" }}>
          ← 관리자 홈
        </Link>
      </div>
      <ProductForm
        initial={{
          id: product.id,
          title: product.title,
          description: product.description,
          imageUrl: product.imageUrl,
          category: product.category,
          price: product.price?.toString() ?? "",
          originalPrice: product.originalPrice?.toString() ?? "",
          isDeal: product.isDeal,
          isPublished: product.isPublished,
          review: product.review,
          pros: product.pros,
          cons: product.cons,
          rating: product.rating?.toString() ?? "",
          ratingCount: product.ratingCount?.toString() ?? "",
          links:
            product.links.length > 0
              ? product.links.map((l) => ({
                  platform: l.platform,
                  url: l.url,
                  price: l.price?.toString() ?? "",
                }))
              : [{ platform: "coupang", url: "" }],
        }}
      />
    </div>
  );
}
