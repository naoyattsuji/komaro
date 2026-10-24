import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { guides, getGuide } from "@/lib/guides";

export const dynamicParams = false;

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const url = `https://komaro.app/guide/${guide.slug}`;
  return {
    title: `${guide.title} — KOMARO`,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url,
      siteName: "KOMARO",
      locale: "ja_JP",
      type: "article",
    },
  };
}

function formatDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const url = `https://komaro.app/guide/${guide.slug}`;
  const others = guides.filter((g) => g.slug !== guide.slug);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.published,
    inLanguage: "ja",
    mainEntityOfPage: url,
    author: { "@type": "Person", name: "辻直哉", url: "https://naoya-tsuji.com" },
    publisher: { "@id": "https://komaro.app/#organization" },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: "https://komaro.app" },
      { "@type": "ListItem", position: 2, name: "日程調整ガイド", item: "https://komaro.app/guide" },
      { "@type": "ListItem", position: 3, name: guide.title, item: url },
    ],
  };

  return (
    <article className="max-w-3xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav className="mb-6 text-xs text-gray-400">
        <Link href="/guide" className="hover:text-gray-600 transition-colors">日程調整ガイド</Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 leading-snug mb-3">{guide.title}</h1>
        <p className="text-xs text-gray-400">{formatDate(guide.published)}</p>
      </header>

      <p className="text-gray-700 leading-relaxed mb-10">{guide.lead}</p>

      <div className="space-y-10">
        {guide.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-bold text-gray-900 mb-3">{s.heading}</h2>
            <div className="space-y-4">
              {s.paragraphs.map((p, i) => (
                <p key={i} className="text-gray-700 leading-relaxed">{p}</p>
              ))}
            </div>
            {s.list && (
              <ul className="mt-4 space-y-2 list-disc pl-5 text-gray-700 leading-relaxed">
                {s.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-12 bg-gray-50 rounded-2xl border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-600 mb-4">登録不要。URLを送るだけで日程調整を始められます。</p>
        <Link
          href="/create"
          className="inline-block bg-gray-900 text-white font-semibold px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
        >
          イベントを作成する
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="font-bold text-gray-800 mb-4">ほかのガイド</h2>
        <ul className="space-y-2">
          {others.map((g) => (
            <li key={g.slug}>
              <Link href={`/guide/${g.slug}`} className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900">
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
