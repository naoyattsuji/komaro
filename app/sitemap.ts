import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://komaro.vercel.app",
      lastModified: new Date("2026-05-11"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://komaro.vercel.app/create",
      lastModified: new Date("2026-05-11"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://komaro.vercel.app/help",
      lastModified: new Date("2026-05-11"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://komaro.vercel.app/terms",
      lastModified: new Date("2026-01-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://komaro.vercel.app/privacy",
      lastModified: new Date("2026-01-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
