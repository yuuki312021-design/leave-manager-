"use client";

import { useEffect, useState } from "react";
import { getCurrentFiscalYear } from "@/lib/utils";

interface FiscalYear {
  id: number;
  year: number;
  grantedDays: number;
  leaveRecords: { consumedDays: number; type: string }[];
}

export default function SettingsPage() {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDays, setEditDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 新規年度追加フォーム
  const [newYear, setNewYear] = useState(String(getCurrentFiscalYear()));
  const [newDays, setNewDays] = useState("");
  const [adding, setAdding] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetch("/api/fiscal-years")
      .then((r) => r.json())
      .then((data: FiscalYear[]) => setFiscalYears(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setAdding(true);
    try {
      const res = await fetch("/api/fiscal-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: Number(newYear),
          grantedDays: Number(newDays),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "追加に失敗しました");
      } else {
        setSuccess(`${newYear}年度を設定しました`);
        setNewDays("");
        loadData();
      }
    } catch {
      setError("通信エラー");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: number) => {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/fiscal-years/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantedDays: Number(editDays) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "更新に失敗しました");
      } else {
        setEditingId(null);
        setSuccess("更新しました");
        loadData();
      }
    } catch {
      setError("通信エラー");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, year: number) => {
    if (!confirm(`${year}年度を削除しますか？取得履歴もすべて削除されます。`))
      return;
    const res = await fetch(`/api/fiscal-years/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFiscalYears((prev) => prev.filter((f) => f.id !== id));
      setSuccess("削除しました");
    } else {
      setError("削除に失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">年度設定</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          年度ごとの有給付与日数を設定します
        </p>
      </div>

      {/* 新規追加フォーム */}
      <div className="card max-w-lg">
        <h3 className="font-semibold text-slate-700 mb-4">年度を追加</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="newYear">
                年度 <span className="text-red-500">*</span>
              </label>
              <input
                id="newYear"
                type="number"
                required
                min="2000"
                max="2100"
                className="input-field"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                placeholder="2024"
              />
              <p className="text-xs text-slate-400 mt-1">
                ※ 4月始まり（例：2024年度 = 2024/4〜2025/3）
              </p>
            </div>
            <div>
              <label className="label" htmlFor="newDays">
                付与日数 <span className="text-red-500">*</span>
              </label>
              <input
                id="newDays"
                type="number"
                required
                min="0"
                max="40"
                step="0.5"
                className="input-field"
                value={newDays}
                onChange={(e) => setNewDays(e.target.value)}
                placeholder="20"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={adding || !newDays}
            className="btn-primary"
          >
            {adding ? "追加中..." : "年度を追加・更新"}
          </button>
          <p className="text-xs text-slate-400">
            ※ 同じ年度が既にある場合は付与日数を上書きします
          </p>
        </form>
      </div>

      {/* 年度一覧 */}
      <div className="card">
        <h3 className="font-semibold text-slate-700 mb-4">設定済み年度一覧</h3>
        {loading ? (
          <div className="text-center py-6 text-slate-400">読み込み中...</div>
        ) : fiscalYears.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            設定済みの年度がありません
          </div>
        ) : (
          <div className="space-y-3">
            {fiscalYears.map((fy) => {
              const consumed = fy.leaveRecords.reduce(
                (sum, r) => sum + r.consumedDays,
                0
              );
              const remaining = fy.grantedDays - consumed;
              const isEditing = editingId === fy.id;

              return (
                <div
                  key={fy.id}
                  className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-700">
                          {fy.year}年度
                        </span>
                        <span className="text-xs text-slate-400">
                          {fy.year}/4/1 〜 {fy.year + 1}/3/31
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            className="input-field w-28"
                            value={editDays}
                            onChange={(e) => setEditDays(e.target.value)}
                            autoFocus
                          />
                          <span className="text-sm text-slate-500">日</span>
                          <button
                            onClick={() => handleUpdate(fy.id)}
                            disabled={saving}
                            className="btn-primary text-sm px-3 py-1.5"
                          >
                            {saving ? "保存中..." : "保存"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="btn-secondary text-sm px-3 py-1.5"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-4 text-sm flex-wrap">
                          <span>
                            付与:{" "}
                            <strong className="text-slate-700">
                              {fy.grantedDays}
                            </strong>{" "}
                            日
                          </span>
                          <span>
                            取得:{" "}
                            <strong className="text-orange-600">
                              {consumed % 1 === 0
                                ? consumed
                                : consumed.toFixed(3).replace(/\.?0+$/, "")}
                            </strong>{" "}
                            日
                          </span>
                          <span>
                            残:{" "}
                            <strong
                              className={
                                remaining <= 5
                                  ? "text-red-600"
                                  : "text-green-600"
                              }
                            >
                              {remaining % 1 === 0
                                ? remaining
                                : remaining.toFixed(3).replace(/\.?0+$/, "")}
                            </strong>{" "}
                            日
                          </span>
                          <span className="text-slate-400">
                            （{fy.leaveRecords.length} 件）
                          </span>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditingId(fy.id);
                            setEditDays(String(fy.grantedDays));
                            setError("");
                            setSuccess("");
                          }}
                          className="btn-secondary text-sm px-3 py-1.5"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(fy.id, fy.year)}
                          className="btn-danger"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
