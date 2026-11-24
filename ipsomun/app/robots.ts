import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL || "https://lipsomun.co.kr";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/go/", "/farm/go/", "/cvs/coupang", "/threads-callback"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
