"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { CheckCircle } from "lucide-react";

const CATEGORIES = ["バグ・不具合の報告", "機能の要望", "使い方がわからない", "その他"];

export function ContactForm() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [message, setMessage]   = useState("");
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) { setError("メールアドレスを入力してください"); return; }
    if (!message.trim()) { setError("メッセージを入力してください"); return; }
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, category, message }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "送信に失敗しました"); return; }
      setSent(true);
    } catch {
      setError("送信に失敗しました。時間をおいてお試しください");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle size={40} className="text-gray-700" />
        <p className="font-semibold text-gray-900">送信しました！</p>
        <p className="text-sm text-gray-500">お問い合わせありがとうございます。内容を確認の上、ご返信します。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">種類</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <Input
        label="お名前（任意）"
        placeholder="例: 田中太郎"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={50}
      />

      <Input
        label="メールアドレス *"
        type="email"
        placeholder="例: your@email.com"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setError(""); }}
      />

      <Textarea
        label="メッセージ *"
        placeholder="お問い合わせ内容を入力してください"
        value={message}
        onChange={(e) => { setMessage(e.target.value); setError(""); }}
        rows={5}
        maxLength={2000}
        hint={`${message.length}/2000文字`}
      />

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <Button className="w-full" onClick={handleSubmit} loading={sending}>
        送信する
      </Button>
    </div>
  );
}
