import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "イベント設定 — KOMARO",
  description: "イベントのタイトル・説明・参加者などの設定を変更します。",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
