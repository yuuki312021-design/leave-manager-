"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_EMAIL } from "@/lib/utils";

interface FeedbackWithUser {
  id: number;
  type: string;
  title: string;
  body: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
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

const STATUS_FLOW: string[] = ["open", "in_progress", "resolved", "closed"];

export default function AdminFeedbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [feedbacks, setFeedbacks] = useState<FeedbackWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // フィルター
  const [filterType, setFilterType] = useState<"all" | "bug" | "feature">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // 編集中のメモ
  const [editingNote, setEditingNote] = useState<Record<number, string>>({});
  const [savingNote, setSavingNote] = useState<number | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  // 管理者チェック
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.email !== ADMIN_EMAIL) {
      router.replace("/");
    }
  }, [session, status, router]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feedback");
      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      const list: FeedbackWithUser[] = data.feedbacks ?? [];
      setFeedbacks(list);
      // 初期メモ値をセット
      const notes: Record<number, string> = {};
      for (const fb of list) {
        notes[fb.id] = fb.adminNote ?? "";
      }
      setEditingNote(notes);
    } catch {
      setError("一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.email === ADMIN_EMAIL) {
      fetchFeedbacks();
    }
  }, [session]);

  // ステータス更新
  const handleStatusChange = async (id: number, newStatus: string) => {
    setError("");
    setSuccess("");
    setUpdatingStatus(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "更新失敗");
      setFeedbacks((prev) =>
        prev.map((fb) => (fb.id === id ? { ...fb, status: newStatus } : fb))
      );
      setSuccess("ステータスを更新しました");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // 管理者メモ保存
  const handleSaveNote = async (id: number) => {
    setError("");
    setSuccess("");
    setSavingNote(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: editingNote[id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失敗");
      setFeedbacks((prev) =>
        prev.map((fb) =>
          fb.id === id ? { ...fb, adminNote: editingNote[id] ?? null } : fb
        )
      );
      setSuccess("返信を保存しました");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSavingNote(null);
    }
  };

  if (status === "loading" || (session && session.user?.email !== ADMIN_EMAIL)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  const filtered = feedbacks.filter((fb) => {
    if (filterType !== "all" && fb.type !== filterType) return false;
    if (filterStatus !== "all" && fb.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">フィードバック管理</h1>

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

      {/* フィルター */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">種別</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "all" | "bug" | "feature")}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">すべて</option>
              <option value="bug">不具合報告</option>
              <option value="feature">機能要望</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">ステータス</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">すべて</option>
              <option value="open">受付中</option>
              <option value="in_progress">対応中</option>
              <option value="resolved">解決済</option>
              <option value="closed">クローズ</option>
            </select>
          </div>
          <div className="ml-auto flex items-end">
            <span className="text-xs text-slate-500">
              {filtered.length} 件 / 合計 {feedbacks.length} 件
            </span>
          </div>
        </div>
      </section>

      {/* フィードバック一覧 */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">該当するフィードバックがありません</p>
        ) : (
          <ul className="space-y-4">
            {filtered.map((fb) => (
              <li
                key={fb.id}
                className="border border-slate-100 rounded-xl p-4"
              >
                {/* ヘッダー */}
                <div className="flex items-start gap-2 flex-wrap mb-2">
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
                  <span className="text-xs text-slate-400 ml-auto">
                    {new Date(fb.createdAt).toLocaleString("ja-JP")}
                  </span>
                </div>

                {/* ユーザー情報 */}
                <p className="text-xs text-slate-500 mb-1">
                  {fb.user.name}（{fb.user.email}）
                </p>

                {/* タイトル・本文 */}
                <p className="text-sm font-semibold text-slate-800">{fb.title}</p>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{fb.body}</p>

                {/* ステータス変更 */}
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-slate-500">ステータス変更:</span>
                  {STATUS_FLOW.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(fb.id, s)}
                      disabled={fb.status === s || updatingStatus === fb.id}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-40 ${
                        fb.status === s
                          ? `${STATUS_COLORS[s]} cursor-default`
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>

                {/* 管理者メモ */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    管理者からの返信・メモ
                  </label>
                  <textarea
                    value={editingNote[fb.id] ?? ""}
                    onChange={(e) =>
                      setEditingNote((prev) => ({ ...prev, [fb.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="返信やメモを入力..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                  />
                  <button
                    onClick={() => handleSaveNote(fb.id)}
                    disabled={savingNote === fb.id}
                    className="mt-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingNote === fb.id ? "保存中..." : "返信を保存"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
