"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { showToast } from "@/components/ui/Toast";
import { Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EditAuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { eventId } = use(params);
  const { token } = use(searchParams);
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoAuthLoading, setAutoAuthLoading] = useState(!!token);
  const [eventTitle, setEventTitle] = useState("");
  const [hasPassword, setHasPassword] = useState(true);

  // Auto-auth with token from URL
  useEffect(() => {
    if (token) {
      setAutoAuthLoading(true);
      fetch(`/api/v1/events/${eventId}/edit-auth?token=${token}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.valid && data.editJwt) {
            sessionStorage.setItem(`edit_jwt_${eventId}`, data.editJwt);
            router.push(`/e/${eventId}/edit/settings`);
          } else {
            setAutoAuthLoading(false);
            setError("編集URLが無効です。パスワードで認証してください。");
          }
        })
        .catch(() => setAutoAuthLoading(false));
    }
  }, [token, eventId, router]);

  // Fetch event info for display
  useEffect(() => {
    fetch(`/api/v1/events/${eventId}`)
      .then((r) => r.json())
      .then((d) => {
        setEventTitle(d.event?.title ?? "");
        setHasPassword(d.event?.hasPassword ?? false);
      })
      .catch(() => {});
  }, [eventId]);

  const handleAuth = async () => {
    if (!password) { setError("パスワードを入力してください"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/events/${eventId}/edit-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "認証に失敗しました");
        return;
      }
      sessionStorage.setItem(`edit_jwt_${eventId}`, data.editJwt);
      showToast("認証しました");
      router.push(`/e/${eventId}/edit/settings`);
    } finally {
      setLoading(false);
    }
  };

  if (autoAuthLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <Link href={`/e/${eventId}`} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm mb-6">
        <ArrowLeft size={16} /> 集計に戻る
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Lock size={22} className="text-gray-700" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">編集認証</h1>
          {eventTitle && <p className="text-sm text-gray-500">{eventTitle}</p>}
        </div>

        {!hasPassword ? (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              このイベントにはパスワードが設定されていません。
              編集者向けURLからアクセスしてください。
            </p>
            <Link href={`/e/${eventId}`}>
              <Button variant="secondary" className="w-full">集計に戻る</Button>
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 mb-4">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <Input
                label="編集パスワード"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="パスワードを入力"
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              />
              <Button className="w-full" onClick={handleAuth} loading={loading}>
                認証する
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
              パスワードを忘れた場合は、編集用URLからアクセスしてください
            </p>
          </>
        )}
      </div>
    </div>
  );
}
