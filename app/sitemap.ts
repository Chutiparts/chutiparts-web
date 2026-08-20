import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://chutibenz.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/products`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/articles`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/w140`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/ebooks`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/ask`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/intake`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("Sitemap: Supabase env vars not found, returning static sitemap only");
    return staticRoutes;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Dynamic product routes (published only)
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("is_published", true);
    if (error) {
      console.error("Sitemap: products query error", error);
    } else if (products) {
      productRoutes = products.map((product) => ({
        url: `${SITE_URL}/products/${product.slug}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
    }
  } catch (err) {
    console.error("Sitemap: products generation error", err);
  }

  // Dynamic article routes (published only) — table: content
  let articleRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data: articles, error } = await supabase
      .from("content")
      .select("slug, published_at")
      .eq("is_published", true);
    if (error) {
      console.error("Sitemap: content query error", error);
    } else if (articles) {
      articleRoutes = articles
        .filter((a) => a.slug)
        .map((a) => ({
          url: `${SITE_URL}/articles/${a.slug}`,
          lastModified: a.published_at ? new Date(a.published_at) : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }));
    }
  } catch (err) {
    console.error("Sitemap: content generation error", err);
  }

  return [...staticRoutes, ...productRoutes, ...articleRoutes];
}
