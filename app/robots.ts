import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/mi-cuenta", "/cuenta-confirmada", "/restablecer", "/media/"] },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
