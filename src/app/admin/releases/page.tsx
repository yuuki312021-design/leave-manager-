"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_EMAIL } from "@/lib/utils";

interface ReleaseNote {
  id: number;
  version: string;
  title: string;
  body: string;
  notified: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminReleasesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [releases, setReleases] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({ version: "", title: "", body: "" });

  // 管理者チェック
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.email !== ADMIN_EMAIL) {
      router.replace("/");
    }
  }, [session, status, router]);

  // リリースノート一覧取得
  const fetchReleases = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/releases");
      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      setReleases(data.releases ?? []);
    } catch {
      setError("一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.email === ADMIN_EMAIL) {
      fetchReleases();
    }
  }, [session]);

  // 登録
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "登録失敗");
      setSuccess(`リリースノート "${form.version}" を登録しました`);
      setForm({ version: "", title: "", body: "" });
      await fetchReleases();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // 即時通知
  const handleNotify = async () => {
    setError("");
    setSuccess("");
    setNotifying(true);
    try {
      const res = await fetch("/api/admin/releases/notify", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "通知失敗");
      setSuccess(
        `通知完了: リリース ${data.releasesProcessed}件、送信 ${data.notificationsSent}件、エラー ${data.errors}件`
      );
      await fetchReleases();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "通知に失敗しました");
    } finally {
      setNotifying(false);
    }
  };

  if (status === "loading" || (session && session.user?.email !== ADMIN_EMAIL)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  const pendingCount = releases.filter((r) => !r.notified).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">リリース管理</h1>

      {/* フィードバック */}
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

      {/* 登録フォーム */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-4">新しいリリースノートを登録</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              バージョン <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="例: v20260811 または 1.2.0"
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="例: バグ修正と通知改善"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              本文 <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="変更内容の説明..."
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              required
              rows={4}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "登録中..." : "登録する"}
          </button>
        </form>
      </section>

      {/* 即時通知ボタン */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-700">即時通知</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              未通知（notified=false）のリリースを全購読ユーザーに今すぐ送信します
            </p>
          </div>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
            未通知 {pendingCount}件
          </span>
        </div>
        <button
          onClick={handleNotify}
          disabled={notifying || pendingCount === 0}
          className="mt-4 w-full bg-amber-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {notifying ? "通知中..." : "今すぐ全ユーザーに通知する"}
        </button>
      </section>

      {/* 一覧 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-4">リリースノート一覧</h2>
        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : releases.length === 0 ? (
          <p className="text-sm text-slate-500">まだリリースノートがありません</p>
        ) : (
          <ul className="space-y-3">
            {releases.map((r) => (
              <li
                key={r.id}
                className="border border-slate-100 rounded-lg p-4 flex items-start gap-3"
              >
                <span
                  className={`mt-0.5 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    r.notified
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.notified ? "通知済" : "未通知"}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-mono">{r.version}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{r.title}</p>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{r.body}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(r.createdAt).toLocaleString("ja-JP")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
