import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約 — KOMARO",
  description: "KOMARoの利用規約です。",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">利用規約</h1>
      <p className="text-sm text-gray-400 mb-10">最終更新日：2026年5月</p>

      <div className="space-y-8 text-gray-700 leading-relaxed text-sm">

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">第1条（適用）</h2>
          <p>
            本利用規約（以下「本規約」）は、KOMARO（以下「本サービス」）の利用に関する条件を定めるものです。
            本サービスを利用したユーザーは、本規約に同意したものとみなします。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">第2条（サービスの内容）</h2>
          <p>
            本サービスは、マトリクス表形式で複数人の空き時間を集約・可視化する日程調整ツールです。
            アカウント登録不要で利用でき、URLを共有するだけで参加者を募ることができます。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">第3条（禁止事項）</h2>
          <p>ユーザーは以下の行為を行ってはなりません。</p>
          <ul className="mt-2 space-y-2 list-disc list-inside">
            <li>法令または公序良俗に違反する行為</li>
            <li>本サービスのサーバーやネットワークに過度な負荷をかける行為</li>
            <li>本サービスを通じて他者を誹謗中傷する行為</li>
            <li>虚偽の情報を登録する行為</li>
            <li>本サービスの運営を妨害する行為</li>
            <li>スパム・大量の自動リクエスト等の行為</li>
            <li>その他、運営者が不適切と判断する行為</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">第4条（データの管理）</h2>
          <p>
            イベントの作成者は、作成時に発行される編集用URLを適切に管理する責任を負います。
            編集用URLを紛失した場合、イベントの編集・削除ができなくなります。
            本サービスは編集用URLの再発行には応じられません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">第5条（データの削除）</h2>
          <p>
            最終更新日から90日間更新がないイベントは自動的に失効し、
            さらに30日後（最終更新から計120日後）に自動削除されます。
            削除されたデータの復元はできません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">第6条（免責事項）</h2>
          <p>
            本サービスは現状のまま提供されます。運営者は以下について責任を負いません。
          </p>
          <ul className="mt-2 space-y-2 list-disc list-inside">
            <li>本サービスの利用に起因する直接・間接の損害</li>
            <li>サービスの停止・中断・変更による損害</li>
            <li>ユーザーが投稿した情報の内容</li>
            <li>通信環境等に起因する不具合</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">第7条（サービスの変更・停止）</h2>
          <p>
            運営者は、ユーザーへの事前通知なしに本サービスの内容を変更、
            または停止することができます。これによりユーザーに損害が生じた場合も、
            運営者は責任を負いません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">第8条（知的財産権）</h2>
          <p>
            本サービスに関する著作権その他の知的財産権は運営者に帰属します。
            ユーザーが本サービスに入力したコンテンツ（イベント名、参加者名等）の
            権利はユーザーに帰属します。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">第9条（準拠法・管轄）</h2>
          <p>
            本規約の解釈は日本法に準拠します。本サービスに関して紛争が生じた場合、
            運営者の所在地を管轄する裁判所を専属的合意管轄とします。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">第10条（お問い合わせ）</h2>
          <p>
            本規約に関するお問い合わせは、{" "}
            <Link href="/help" className="text-gray-700 underline">
              ヘルプページのお問い合わせフォーム
            </Link>
            よりご連絡ください。
          </p>
        </section>

      </div>
    </div>
  );
}
