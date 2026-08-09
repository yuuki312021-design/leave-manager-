"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("メールアドレスまたはパスワードが正しくありません");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">有給管理</h1>
          <p className="text-sm text-slate-500 mt-1">Leave Manager</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">ログイン</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input-field"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="input-field"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
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
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            <Link href="/auth/forgot-password" className="text-blue-600 hover:underline font-medium">
              パスワードを忘れた方はこちら
            </Link>
          </p>

          <p className="text-center text-sm text-slate-500 mt-3">
            アカウントをお持ちでない方は{" "}
            <Link href="/signup" className="text-blue-600 hover:underline font-medium">
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
