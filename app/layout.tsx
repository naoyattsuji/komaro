import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/ui/Toast";
import Link from "next/link";
import Image from "next/image";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "KOMARO — コマで見る日程調整",
  description: "会員登録不要・URL共有で使える日程調整サービス。全員の空き時間をコマの色で可視化し、最適な日程がひと目でわかります。",
  verification: {
    google: "5urXdpMctfnAZKVgbC7piw2KOctwpNlqCgSCgXT3ayw",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white antialiased font-sans">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/komaro-icon.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" priority />
              <Image src="/komaro-word.png" alt="KOMARO" width={110} height={30} className="h-7 w-auto object-contain" priority />
            </Link>
            <nav className="flex items-center gap-5">
              <Link href="/help" className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors">
                ヘルプ
              </Link>
              <Link href="/create" className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md transition-colors whitespace-nowrap">
                イベントを作成
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-100 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Image src="/komaro-icon.png" alt="" width={20} height={20} className="h-5 w-5 object-contain opacity-40" />
              <span className="text-xs text-gray-400">© 2026 KOMARO</span>
            </div>
            <Link href="/help" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">ヘルプ / FAQ</Link>
          </div>
        </footer>
        <ToastContainer />
      </body>
    </html>
  );
}
