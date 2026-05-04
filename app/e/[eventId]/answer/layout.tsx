import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "日程調整に回答する — KOMARO",
  description: "空いている日程・時間帯を選択して回答してください。会員登録不要・URLを開くだけで参加できます。",
};

export default function AnswerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
