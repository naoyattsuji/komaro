import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-5xl font-bold text-gray-200 mb-4">404</h1>
      <h2 className="text-xl font-bold text-gray-800 mb-2">ページが見つかりません</h2>
      <p className="text-gray-500 text-sm mb-6">
        お探しのイベントは削除されたか、URLが正しくない可能性があります。
      </p>
      <Link href="/" className="bg-gray-900 text-white font-medium px-6 py-3 rounded-md hover:bg-gray-700 transition-colors">
        トップへ戻る
      </Link>
    </div>
  );
}
