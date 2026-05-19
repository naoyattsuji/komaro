import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "イベントを作成 — KOMARO（無料・登録不要の日程調整）",
  description: "無料で日程調整イベントを作成。イベント名と日程を入力するだけで、グループ全員の空き時間を一覧できるURLを発行します。会員登録不要・スマホ対応。",
  alternates: {
    canonical: "https://komaro.app/create",
  },
  openGraph: {
    title: "イベントを作成 — KOMARO",
    description: "無料で日程調整イベントを作成。会員登録不要・URLを送るだけで回答を集められます。",
    url: "https://komaro.app/create",
    siteName: "KOMARO",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "イベントを作成 — KOMARO",
    description: "無料で日程調整イベントを作成。会員登録不要・URLを送るだけで回答を集められます。",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "ホーム", item: "https://komaro.app" },
    { "@type": "ListItem", position: 2, name: "イベントを作成", item: "https://komaro.app/create" },
  ],
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
