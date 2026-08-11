"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import {
  calcSpecialLeaveInfo,
  calcTenure,
  getCurrentFiscalYear,
} from "@/lib/utils";
import PushNotificationManager from "@/components/PushNotificationManager";

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

  // 通知設定
  const [pushEnabled, setPushEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [notifSuccess, setNotifSuccess] = useState("");

  // 新規年度追加フォーム
  const [newYear, setNewYear] = useState(String(getCurrentFiscalYear()));
  const [newDays, setNewDays] = useState("");
  const [adding, setAdding] = useState(false);

  // アカウント削除ダイアログ
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deletePasswordRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/fiscal-years").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/push/status").then((r) => r.json()),
    ])
      .then(([fyData, profileData, pushData]: [FiscalYear[], Profile, { pushEnabled: boolean; reminderTime: string }]) => {
        setFiscalYears(fyData);
        setProfile(profileData);
        setJoinedAt(profileData.joinedAt ?? "");
        if (pushData && !pushData.hasOwnProperty("error")) {
          setPushEnabled(pushData.pushEnabled ?? false);
          setReminderTime(pushData.reminderTime ?? "09:00");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // ダイアログが開いたらパスワード欄にフォーカス
  useEffect(() => {
    if (deleteDialogOpen) {
      setTimeout(() => deletePasswordRef.current?.focus(), 50);
    }
  }, [deleteDialogOpen]);

  const handleNotifSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifError("");
    setNotifSuccess("");
    setNotifSaving(true);
    try {
      const res = await fetch("/api/user/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushEnabled, reminderTime }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotifError(data.error ?? "保存に失敗しました");
      } else {
        setNotifSuccess("通知設定を保存しました");
      }
    } catch {
      setNotifError("通信エラー");
    } finally {
      setNotifSaving(false);
    }
  };

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

  const openDeleteDialog = () => {
    setDeletePassword("");
    setDeleteError("");
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteDialogOpen(false);
    setDeletePassword("");
    setDeleteError("");
  };

  const handleAccountDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "削除に失敗しました");
      } else {
        // セッションを終了してログインページへ
        await signOut({ callbackUrl: "/login" });
      }
    } catch {
      setDeleteError("通信エラーが発生しました");
    } finally {
      setDeleting(false);
    }
  };

  const tenure = joinedAt ? calcTenure(joinedAt) : null;
  const specialLeave = joinedAt ? calcSpecialLeaveInfo(joinedAt, []) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white drop-shadow">設定</h2>
        <p className="text-sm text-white/75 mt-0.5">
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
                {tenure.years}年{tenure.months}か月目
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

      {/* プッシュ通知設定 */}
      <div className="card max-w-lg">
        <h3 className="font-semibold text-slate-700 mb-4">プッシュ通知</h3>
        <form onSubmit={handleNotifSave} className="space-y-4">
          {/* ON/OFFトグル */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">通知を有効にする</p>
              <p className="text-xs text-slate-400 mt-0.5">
                有給取得前日・当日にリマインダーを受信します
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pushEnabled}
              onClick={() => setPushEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                pushEnabled ? "bg-blue-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  pushEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* 通知時刻 */}
          <div>
            <label className="label" htmlFor="reminderTime">
              通知時刻
            </label>
            <input
              id="reminderTime"
              type="time"
              className="input-field w-36"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              有給取得前日の指定時刻に通知が届きます
            </p>
          </div>

          {/* 購読管理 */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">この端末の購読状態</p>
            <PushNotificationManager />
          </div>

          {notifError && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              {notifError}
            </div>
          )}
          {notifSuccess && (
            <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg">
              {notifSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={notifSaving}
            className="btn-primary"
          >
            {notifSaving ? "保存中..." : "通知設定を保存"}
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

      {/* アカウント削除セクション */}
      <div className="card max-w-lg border-red-100">
        <h3 className="font-semibold text-slate-700 mb-1">アカウント削除</h3>
        <p className="text-sm text-slate-500 mb-4">
          アカウントを削除すると、すべての有給データが完全に失われます。この操作は取り消せません。
        </p>
        <button
          type="button"
          onClick={openDeleteDialog}
          className="text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors"
        >
          アカウントを削除する
        </button>
      </div>

      {/* 削除確認ダイアログ */}
      {deleteDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteDialog();
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h4 className="text-lg font-bold text-slate-800">
                アカウントを削除しますか？
              </h4>
              <p className="text-sm text-slate-500 mt-1">
                この操作は取り消せません。すべての有給データ（取得履歴・年度設定）が完全に削除されます。
              </p>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
              削除するとアカウントに二度とアクセスできなくなります。
            </div>

            <form onSubmit={handleAccountDelete} className="space-y-4">
              <div>
                <label className="label" htmlFor="deletePassword">
                  現在のパスワードを入力して確認
                </label>
                <input
                  id="deletePassword"
                  ref={deletePasswordRef}
                  type="password"
                  required
                  className="input-field"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="パスワード"
                  disabled={deleting}
                  autoComplete="current-password"
                />
              </div>

              {deleteError && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-3 justify-end flex-wrap">
                <button
                  type="button"
                  onClick={closeDeleteDialog}
                  disabled={deleting}
                  className="btn-secondary"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={deleting || !deletePassword}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? "削除中..." : "削除する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
