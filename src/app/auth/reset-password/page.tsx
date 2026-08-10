"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // tokenなしで直接アクセスした場合
  if (!token) {
    return (
      <div className="bg-red-50 text-red-600 text-sm px-4 py-4 rounded-lg text-center">
        無効なリンクです。パスワード再設定メールのリンクからアクセスしてください。
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (form.password.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "パスワードの変更に失敗しました");
        setLoading(false);
        return;
      }

      router.push("/login");
    } catch {
      setError("通信エラーが発生しました");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">
          新しいパスワード
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          className="input-field"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          placeholder="8文字以上"
        />
      </div>

      <div>
        <label className="label" htmlFor="confirmPassword">
          新しいパスワード（確認）
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="input-field"
          value={form.confirmPassword}
          onChange={(e) =>
            setForm((p) => ({ ...p, confirmPassword: e.target.value }))
          }
          placeholder="もう一度入力"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? "変更中..." : "変更"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white drop-shadow">有給管理</h1>
          <p className="text-sm text-slate-200 mt-1">Leave Manager</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">
            パスワード再設定
          </h2>

          <Suspense
            fallback={
              <div className="text-sm text-slate-500 text-center py-4">
                読み込み中...
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>

          <p className="text-center text-sm text-slate-500 mt-6">
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              ログイン画面に戻る
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
