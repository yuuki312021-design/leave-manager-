"use client";

import { useEffect, useState } from "react";
import {
  calcSpecialLeaveInfo,
  calcTenure,
  getCurrentFiscalYear,
} from "@/lib/utils";

interface FiscalYear {
  id: number;
  year: number;
  grantedDays: number;
  leaveRecords: { consumedDays: number; type: string }[];
}

interface Profile {
  id: number;
  name: string;
  email: string;
  joinedAt: string | null;
}

export default function SettingsPage() {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [joinedAt, setJoinedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
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
    Promise.all([
      fetch("/api/fiscal-years").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ])
      .then(([fyData, profileData]: [FiscalYear[], Profile]) => {
        setFiscalYears(fyData);
        setProfile(profileData);
        setJoinedAt(profileData.joinedAt ?? "");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setProfileSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinedAt: joinedAt || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
      } else {
        setProfile(data);
        setJoinedAt(data.joinedAt ?? "");
        setSuccess("プロフィールを保存しました");
      }
    } catch {
      setError("通信エラー");
    } finally {
      setProfileSaving(false);
    }
  };

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

  const tenure = joinedAt ? calcTenure(joinedAt) : null;
  const specialLeave = joinedAt ? calcSpecialLeaveInfo(joinedAt, []) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">設定</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          プロフィールと年度ごとの有給付与日数を設定します
        </p>
      </div>

      {/* プロフィール設定 */}
      <div className="card max-w-lg">
        <h3 className="font-semibold text-slate-700 mb-4">プロフィール</h3>
        {profile && (
          <div className="mb-4 text-sm text-slate-600 space-y-1">
            <p>
              <span className="text-slate-400">名前:</span> {profile.name}
            </p>
            <p>
              <span className="text-slate-400">メール:</span> {profile.email}
            </p>
          </div>
        )}
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="label" htmlFor="joinedAt">
              入社日
            </label>
            <input
              id="joinedAt"
              type="date"
              className="input-field"
              value={joinedAt}
              onChange={(e) => setJoinedAt(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              入社日を設定すると勤続年数と特別有給の判定が有効になります
            </p>
          </div>

          {tenure && (
            <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
              勤続年数:{" "}
              <strong className="text-slate-800">
                {tenure.years}年{tenure.months}か月
              </strong>
            </div>
          )}
          {specialLeave?.isEligible && (
            <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              入社{specialLeave.milestone}年の特別有給対象期間です（
              {specialLeave.anniversaryStart} 〜 {specialLeave.anniversaryEnd}）
            </div>
          )}

          <button
            type="submit"
            disabled={profileSaving}
            className="btn-primary"
          >
            {profileSaving ? "保存中..." : "プロフィールを保存"}
          </button>
        </form>
      </div>

      {/* 新規年度追加フォーム */}
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
              const consumed = fy.leaveRecords
                .filter((r) => r.type !== "special")
                .reduce((sum, r) => sum + r.consumedDays, 0);
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
                                : consumed
                                    .toFixed(3)
                                    .replace(/\.?0+$/, "")}
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
                                : remaining
                                    .toFixed(3)
                                    .replace(/\.?0+$/, "")}
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
