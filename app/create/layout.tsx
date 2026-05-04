import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "イベントを作成 — KOMARO",
  description: "日程調整イベントを作成します。イベント名・日程・時間帯を設定するだけ。会員登録不要です。",
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
