import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/_next/"],
      },
    ],
    sitemap: "https://chutiparts-web.vercel.app/sitemap.xml",
    host: "https://chutiparts-web.vercel.app",
  };
}
