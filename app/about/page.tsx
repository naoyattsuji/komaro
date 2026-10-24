import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "運営者情報 — KOMARO",
  description: "日程調整サービス KOMARO の運営者情報です。サービスの考え方、データの扱い、広告について、お問い合わせ先をまとめています。",
  alternates: {
    canonical: "https://komaro.app/about",
  },
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">運営者情報</h1>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">KOMAROについて</h2>
          <p>
            KOMAROは、グループの日程調整のための無料のサービスです。日付や時間帯を表にして、参加者が空いている「コマ」をタップするだけで答えられます。集計画面では、空いている人が多いコマほど色が濃くなり、どこで集まれるかがひと目で分かります。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">大事にしていること</h2>
          <ul className="space-y-2 list-disc pl-5">
            <li>会員登録やアプリのインストールなしで、URLを開くだけで使えること</li>
            <li>スマホでも迷わず答えられること</li>
            <li>集める人が表をまとめ直さなくて済むこと</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">データの扱い</h2>
          <p>
            イベントは、最後の更新から90日たつと新しい回答を受け付けなくなり、さらに30日後に自動で削除されます。作成した人は、いつでもイベントを削除できます。詳しくは
            <Link href="/privacy" className="underline underline-offset-4 hover:text-gray-900">プライバシーポリシー</Link>
            をご覧ください。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">広告について</h2>
          <p>
            KOMAROは無料で提供するため、一部のページに Google AdSense の広告を掲載しています。回答の入力など操作の途中には広告を置かず、パーソナライズされていない広告のみを表示しています。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">運営者</h2>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
            <dt className="text-gray-500">運営</dt>
            <dd>辻 直哉（個人で開発・運営しています）</dd>
            <dt className="text-gray-500">ウェブサイト</dt>
            <dd>
              <a href="https://naoya-tsuji.com" className="underline underline-offset-4 hover:text-gray-900">naoya-tsuji.com</a>
            </dd>
            <dt className="text-gray-500">お問い合わせ</dt>
            <dd>
              <a href="https://naoya-tsuji.com/?topic=komaro#contact" className="underline underline-offset-4 hover:text-gray-900">お問い合わせフォーム</a>
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
