import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";

export const metadata = {
  title: "ヘルプ / FAQ — KOMARO",
};

const faqs = [
  {
    q: "イベントを作成するには？",
    a: "トップページまたは画面上部の「イベントを作成」ボタンから作成できます。イベント名・表の形式・軸ラベルを設定するだけで完了です。会員登録は不要です。",
  },
  {
    q: "参加者を招待するには？",
    a: "イベント作成後に表示される「参加者向けURL」をコピーして、LINE・チャット・メールなどで共有してください。URLを開くだけで参加できます。",
  },
  {
    q: "自分の回答を修正したい",
    a: "イベントの集計画面から「自分の回答を編集する」ボタンをタップし、登録時と同じ名前を入力すると編集画面に移動できます。",
  },
  {
    q: "編集用URLを紛失してしまった",
    a: "編集パスワードを設定している場合は、イベントURL末尾に /edit を追加してアクセスし、パスワードで認証できます。パスワードも設定していない場合は、残念ながら編集・削除ができません。次回から必ず編集URLをメモしてください。",
  },
  {
    q: "イベントが消えてしまった",
    a: "最後の更新（回答・コメント・設定変更）から90日間更新がないと自動的に「失効」状態になり、新規回答ができなくなります。さらに30日後（計120日後）に自動的に削除されます。",
  },
  {
    q: "参加者上限を超えている場合は？",
    a: "上限に達すると新規の回答登録ができなくなります。イベント作成者が編集画面で上限を引き上げるか、不要な参加者を削除することで空きを作れます。",
  },
  {
    q: "セルをタップすると何が表示されますか？",
    a: "集計画面でセルをタップすると、そのコマに参加可能な参加者名の一覧が表示されます。また参加不可の参加者一覧も確認できます。",
  },
  {
    q: "特定のメンバーが参加できるコマだけ見たい",
    a: "集計画面の参加者一覧から名前をタップすると、その参加者が参加可能なセルがハイライトされます。複数名を選択した場合は全員参加可能なセルのみ強調されます（AND条件）。",
  },
  {
    q: "表の形式は後から変更できますか？",
    a: "現在の仕様では、イベント作成後に表の形式（時間割・カレンダー・任意ラベル）を変更することはできません。軸ラベルの追加は編集画面から可能です。",
  },
  {
    q: "コメントを削除したい",
    a: "コメントの削除は、編集権限（編集URLまたはパスワード）を持つ作成者のみが可能です。現在のMVPでは編集画面からのコメント削除機能は準備中です。",
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ヘルプ / FAQ</h1>
        <p className="text-gray-500 text-sm">よくあるご質問をまとめました</p>
      </div>

      {/* Quick start */}
      <section className="mb-10 bg-gray-100 rounded-2xl p-6 border border-gray-200">
        <h2 className="font-bold text-gray-900 mb-4">クイックスタート</h2>
        <ol className="space-y-3 text-sm text-gray-800">
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-bold">1</span>
            <span>
              <strong>イベントを作成</strong> — トップページの「イベントを作成する」から開始。イベント名と表の形式を選びます。
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-bold">2</span>
            <span>
              <strong>URLを共有</strong> — 作成完了後に表示される「参加者向けURL」をコピーしてメンバーに送ります。
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-bold">3</span>
            <span>
              <strong>回答を集める</strong> — 参加者はURLを開いて名前を入力し、参加できるコマをタップするだけ。
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-bold">4</span>
            <span>
              <strong>集計を確認</strong> — ヒートマップで全体の空き状況を確認。セルをタップで参加者名も確認できます。
            </span>
          </li>
        </ol>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="font-bold text-gray-800 mb-4">よくある質問</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium text-gray-800 hover:bg-gray-50 list-none">
                {faq.q}
                <ChevronDown
                  size={16}
                  className="text-gray-400 shrink-0 ml-2 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Contact form */}
      <section className="mt-12 bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-bold text-gray-900 mb-1">お問い合わせ</h2>
        <p className="text-sm text-gray-500 mb-6">FAQで解決しない場合はこちらからご連絡ください。</p>
        <ContactForm />
      </section>

      <div className="mt-10 text-center">
        <Link href="/create">
          <button className="bg-gray-900 text-white font-semibold px-8 py-4 rounded-md hover:bg-gray-700 transition-colors">
            さっそくイベントを作成する
          </button>
        </Link>
      </div>
    </div>
  );
}
