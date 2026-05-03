import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー — KOMARO",
  description: "KOMARoのプライバシーポリシー（個人情報保護方針）です。",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">プライバシーポリシー</h1>
      <p className="text-sm text-gray-400 mb-10">最終更新日：2026年5月</p>

      <div className="prose prose-sm prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">1. 基本方針</h2>
          <p>
            KOMARO（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
            本ポリシーは、本サービスにおける個人情報の取り扱いについて説明するものです。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">2. 収集する情報</h2>
          <p>本サービスでは、以下の情報を取り扱います。</p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
            <li>イベント情報（イベント名、詳細説明、軸ラベル等）</li>
            <li>参加者が入力した名前および回答（参加可能コマ）</li>
            <li>お問い合わせフォームへの入力内容（お名前、メールアドレス、メッセージ）</li>
            <li>アクセスログ（IPアドレス、ブラウザ情報等）</li>
          </ul>
          <p className="mt-3">
            本サービスはアカウント登録を必要とせず、氏名・メールアドレス等の個人情報を
            意図的に収集することはありません。参加者名として入力される情報はニックネーム等でも構いません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">3. 情報の利用目的</h2>
          <ul className="space-y-1 list-disc list-inside text-sm">
            <li>本サービスの提供および運営</li>
            <li>お問い合わせへの対応</li>
            <li>サービスの改善・機能追加のための分析</li>
            <li>不正利用の防止</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">4. 第三者への提供</h2>
          <p>
            本サービスは、以下の場合を除き、収集した情報を第三者に提供・開示しません。
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく開示が必要な場合</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">5. 外部サービスの利用</h2>
          <p>本サービスは以下の外部サービスを利用しています。</p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
            <li>
              <strong>Vercel</strong>（ホスティング）—{" "}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gray-600 underline">
                プライバシーポリシー
              </a>
            </li>
            <li>
              <strong>Neon</strong>（データベース）—{" "}
              <a href="https://neon.tech/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gray-600 underline">
                プライバシーポリシー
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">6. データの保存期間</h2>
          <p>
            イベントデータは、最終更新日から90日間更新がない場合に失効状態となり、
            さらに30日後（最終更新から計120日後）に自動削除されます。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">7. Cookie・トラッキング</h2>
          <p>
            本サービスは現在、マーケティング目的のCookieやトラッキングツールを使用していません。
            将来的にアクセス解析ツールを導入する場合は、本ポリシーを更新のうえお知らせします。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">8. お問い合わせ</h2>
          <p>
            プライバシーに関するお問い合わせは、{" "}
            <Link href="/help" className="text-gray-700 underline">
              ヘルプページのお問い合わせフォーム
            </Link>
            よりご連絡ください。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">9. 改定</h2>
          <p>
            本ポリシーは必要に応じて改定されることがあります。
            重要な変更がある場合はサービス上でお知らせします。
          </p>
        </section>

      </div>
    </div>
  );
}
