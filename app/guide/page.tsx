import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { guides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "日程調整ガイド — KOMARO",
  description:
    "日程調整を早くまとめるためのコツをまとめました。候補の出し方、飲み会・会議・サークル・保護者会など場面ごとの進め方、返事が集まらないときの対処法を解説します。",
  alternates: {
    canonical: "https://komaro.app/guide",
  },
  openGraph: {
    title: "日程調整ガイド — KOMARO",
    description: "日程調整を早くまとめるためのコツ。場面ごとの進め方と、困ったときの対処法。",
    url: "https://komaro.app/guide",
    siteName: "KOMARO",
    locale: "ja_JP",
    type: "website",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: "https://komaro.app" },
    { "@type": "ListItem", position: 2, name: "日程調整ガイド", item: "https://komaro.app/guide" },
  ],
};

export default function GuideIndexPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">日程調整ガイド</h1>
        <p className="text-gray-500 text-sm">日程調整を早くまとめるためのコツをまとめました。</p>
      </div>

      <ul className="space-y-3">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/guide/${g.slug}`}
              className="flex items-center justify-between gap-4 bg-white rounded-xl border border-gray-200 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <span>
                <span className="block font-medium text-gray-900">{g.title}</span>
                <span className="block mt-1 text-sm text-gray-500 leading-relaxed">{g.description}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-gray-400" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
