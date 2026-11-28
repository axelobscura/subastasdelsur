import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getCatalogProducts, getPublishedAuctions } from "@/lib/catalog";
import { siteUrl } from "@/lib/site-url";

// Published, listed auctions and their lots only (never drafts or unlisted auctions).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // built per request from the (cached) catalog, never at build time
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const auctions = await getPublishedAuctions();
  const entries: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/subastas"), changeFrequency: "hourly", priority: 0.9 },
  ];
  for (const a of auctions) {
    entries.push({ url: url(`/subastas/${a.slug}`), lastModified: a.startsAt, changeFrequency: "hourly", priority: 0.8 });
    for (const p of await getCatalogProducts(a.id)) entries.push({ url: url(`/subastas/${a.slug}/${p.lotNumber}`), changeFrequency: "hourly", priority: 0.6 });
  }
  return entries;
}
