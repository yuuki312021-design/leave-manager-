"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Feedback {
  id: number;
  type: string;
  title: string;
  body: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  open: "受付中",
  in_progress: "対応中",
  resolved: "解決済",
  closed: "クローズ",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-500",
};

export default function FeedbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({ type: "bug", title: "", body: "" });

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/login");
    }
  }, [session, status, router]);

  const fetchFeedbacks = async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      setFeedbacks(data.feedbacks ?? []);
    } catch {
      // サイレントに失敗
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchFeedbacks();
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "送信失敗");
      setSuccess("フィードバックを送信しました。ありがとうございます！");
      setForm({ type: "bug", title: "", body: "" });
      await fetchFeedbacks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">フィードバック</h1>
      <p className="text-sm text-slate-500 mb-6">
        不具合の報告や機能追加のご要望をお送りください。
      </p>

      {/* フィードバックメッセージ */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* 送信フォーム */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-4">新しいフィードバックを送信</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 種別選択 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              種別 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="bug"
                  checked={form.type === "bug"}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="accent-blue-600"
                />
                <span className="text-sm text-slate-700">不具合報告</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="feature"
                  checked={form.type === "feature"}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="accent-blue-600"
                />
                <span className="text-sm text-slate-700">機能追加要望</span>
              </label>
            </div>
          </div>

          {/* タイトル */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder={
                form.type === "bug"
                  ? "例: ○○ページで△△が表示されない"
                  : "例: ○○機能を追加してほしい"
              }
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* 詳細 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              詳細 <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder={
                form.type === "bug"
                  ? "発生状況や手順、スクリーンショットの説明などを記載してください..."
                  : "どんな機能がほしいか、背景・理由なども記載してください..."
              }
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              required
              rows={5}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "送信中..." : "送信する"}
          </button>
        </form>
      </section>

      {/* 過去のフィードバック一覧 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-4">送信済みフィードバック</h2>
        {loadingList ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : feedbacks.length === 0 ? (
          <p className="text-sm text-slate-500">まだフィードバックがありません</p>
        ) : (
          <ul className="space-y-3">
            {feedbacks.map((fb) => (
              <li
                key={fb.id}
                className="border border-slate-100 rounded-lg p-4"
              >
                <div className="flex items-start gap-2 flex-wrap mb-1">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[fb.status] ?? "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {STATUS_LABELS[fb.status] ?? fb.status}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {fb.type === "bug" ? "不具合報告" : "機能要望"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 mt-1">{fb.title}</p>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{fb.body}</p>
                {fb.adminNote && (
                  <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs font-medium text-blue-600 mb-0.5">管理者からの返信</p>
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">{fb.adminNote}</p>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  {new Date(fb.createdAt).toLocaleString("ja-JP")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
