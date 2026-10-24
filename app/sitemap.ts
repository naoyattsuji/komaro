import { MetadataRoute } from "next";
import { guides } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://komaro.app",
      lastModified: new Date("2026-10-25"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://komaro.app/create",
      lastModified: new Date("2026-05-15"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: "https://komaro.app/guide",
      lastModified: new Date("2026-10-25"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...guides.map((g) => ({
      url: `https://komaro.app/guide/${g.slug}`,
      lastModified: new Date(g.published),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: "https://komaro.app/help",
      lastModified: new Date("2026-05-15"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: "https://komaro.app/about",
      lastModified: new Date("2026-10-25"),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: "https://komaro.app/terms",
      lastModified: new Date("2026-01-01"),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: "https://komaro.app/privacy",
      lastModified: new Date("2026-01-01"),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
