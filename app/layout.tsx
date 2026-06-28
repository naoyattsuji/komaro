import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/ui/Toast";
import { NativeAppChrome } from "@/components/NativeAppChrome";
import Link from "next/link";
import Image from "next/image";
import { GoogleAnalytics } from "@next/third-parties/google";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "KOMARO — コマで見る日程調整",
  description: "無料で使える日程調整ツール。会員登録不要・URLを共有するだけ。グループ全員の空き時間をコマの色でひと目確認。スケジュール調整に最適な無料サービスです。",
  metadataBase: new URL("https://komaro.app"),
  alternates: {
    canonical: "https://komaro.app",
  },
  openGraph: {
    title: "KOMARO — コマで見る日程調整",
    description: "無料で使える日程調整ツール。会員登録不要・URLを共有するだけ。グループ全員の空き時間をコマの色でひと目確認。スケジュール調整に最適な無料サービスです。",
    url: "https://komaro.app",
    siteName: "KOMARO",
    locale: "ja_JP",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "KOMARO — コマで見る日程調整",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KOMARO — コマで見る日程調整",
    description: "会員登録不要・URL共有で使える日程調整サービス。全員の空き時間をコマの色で可視化します。",
    images: ["/opengraph-image"],
  },
  verification: {
    google: "5urXdpMctfnAZKVgbC7piw2KOctwpNlqCgSCgXT3ayw",
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://komaro.app/#website",
    name: "KOMARO",
    url: "https://komaro.app",
    description: "会員登録不要・URL共有で使える日程調整サービス。全員の空き時間をコマの色で可視化し、最適な日程がひと目でわかります。",
    inLanguage: "ja",
    publisher: { "@id": "https://komaro.app/#organization" },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://komaro.app/#organization",
    name: "KOMARO",
    url: "https://komaro.app",
    logo: {
      "@type": "ImageObject",
      url: "https://komaro.app/icon.png",
    },
    sameAs: [],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://komaro.app/#webpage",
    url: "https://komaro.app",
    name: "KOMARO — コマで見る日程調整",
    isPartOf: { "@id": "https://komaro.app/#website" },
    about: { "@id": "https://komaro.app/#organization" },
    description: "無料で使える日程調整ツール。会員登録不要・URLを共有するだけ。グループ全員の空き時間をコマの色でひと目確認。",
    inLanguage: "ja",
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "ホーム",
          item: "https://komaro.app",
        },
      ],
    },
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${geist.variable} h-full overflow-x-hidden overflow-y-scroll`}>
      <body className="min-h-full flex flex-col overflow-x-hidden bg-white antialiased font-sans">
        <NativeAppChrome />
        <header className="sticky top-0 z-30 bg-white border-b border-gray-100 pt-safe">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 shrink items-center">
              <Link href="/" className="flex min-w-0 items-center gap-2.5">
                <Image src="/komaro-logo.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" priority />
                <Image src="/komaro-word.png" alt="KOMARO" width={110} height={30} className="h-6 w-auto min-w-0 object-contain sm:h-7" priority />
              </Link>
            </div>
            <nav className="flex shrink-0 items-center gap-5">
              <Link href="/help" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors">
                ヘルプ
              </Link>
              <Link href="/create" className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 px-3 py-2 rounded-md transition-colors whitespace-nowrap sm:px-4" aria-label="イベントを作成">
                <span className="sm:hidden">作成</span>
                <span className="hidden sm:inline">イベントを作成</span>
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="native-app-hidden border-t border-gray-100 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image src="/komaro-logo.png" alt="" width={20} height={20} className="h-5 w-5 object-contain opacity-40" />
              <span className="text-xs text-gray-400">© 2026 KOMARO</span>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/help" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">ヘルプ / FAQ</Link>
              <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">利用規約</Link>
              <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">プライバシーポリシー</Link>
            </div>
          </div>
        </footer>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ToastContainer />
        <GoogleAnalytics gaId="G-BM1B0C55N2" />
      </body>
    </html>
  );
}
