import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "作成完了 — KOMARO",
  description: "日程調整イベントの作成が完了しました。参加者向けURLを共有して回答を集めましょう。",
};

export default function CreateDoneLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
