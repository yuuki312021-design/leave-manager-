"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import {
  calcSpecialLeaveInfo,
  calcTenure,
  getCurrentFiscalYear,
} from "@/lib/utils";
import PushNotificationManager from "@/components/PushNotificationManager";
import { BG_LS_KEY } from "@/components/BackgroundProvider";
import { useBgTheme } from "@/hooks/useBgTheme";

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

// ───────────────────────────────────────────
// アコーディオン section
// ───────────────────────────────────────────
function AccordionSection({
  id,
  icon,
  title,
  description,
  isOpen,
  onToggle,
  danger,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  description?: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden transition-shadow ${
        danger ? "border-red-100" : "border-slate-200"
      } ${isOpen ? "shadow-sm" : ""}`}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${
          isOpen ? "bg-slate-50" : "hover:bg-slate-50"
        }`}
      >
        <span className="text-xl flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              danger ? "text-red-700" : "text-slate-800"
            }`}
          >
            {title}
          </p>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-5 pb-6 pt-4 border-t border-slate-100">{children}</div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────
// 画像リサイズ・圧縮（Canvas API）
// ───────────────────────────────────────────
async function resizeAndCompress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX_W = 1920;
        let w = img.width;
        let h = img.height;
        if (w > MAX_W) {
          h = Math.round((h * MAX_W) / w);
          w = MAX_W;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas context unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => reject(new Error("image load error"));
      img.src = evt.target?.result as string;
    };
    reader.onerror = () => reject(new Error("file read error"));
    reader.readAsDataURL(file);
  });
}

// ───────────────────────────────────────────
// 設定ページ本体
// ───────────────────────────────────────────
export default function SettingsPage() {
  const bgTheme = useBgTheme();
  const isDark = bgTheme === "dark";
  // データ
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [joinedAt, setJoinedAt] = useState("");
  const [loading, setLoading] = useState(true);

  // プロフィール保存
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // 年度設定
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDays, setEditDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [fiscalError, setFiscalError] = useState("");
  const [fiscalSuccess, setFiscalSuccess] = useState("");

  // 新規年度追加
  const [newYear, setNewYear] = useState(String(getCurrentFiscalYear()));
  const [newDays, setNewDays] = useState("");
  const [adding, setAdding] = useState(false);

  // 通知設定
  const [pushEnabled, setPushEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [notifSuccess, setNotifSuccess] = useState("");

  // テスト通知
  const [testNotifLoading, setTestNotifLoading] = useState(false);
  const [testNotifResult, setTestNotifResult] = useState<string | null>(null);

  // アカウント削除
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deletePasswordRef = useRef<HTMLInputElement>(null);

  // 背景画像設定
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgError, setBgError] = useState("");
  const [bgSuccess, setBgSuccess] = useState("");
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // アコーディオン開閉状態（複数同時展開可）
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["profile"])
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ───── データ読み込み ─────
  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/fiscal-years").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/push/status").then((r) => r.json()),
    ])
      .then(
        ([fyData, profileData, pushData]: [
          FiscalYear[],
          Profile,
          { pushEnabled: boolean; reminderTime: string },
        ]) => {
          setFiscalYears(fyData);
          setProfile(profileData);
          setJoinedAt(profileData.joinedAt ?? "");
          if (pushData && !Object.prototype.hasOwnProperty.call(pushData, "error")) {
            setPushEnabled(pushData.pushEnabled ?? false);
            setReminderTime(pushData.reminderTime ?? "09:00");
          }
        }
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // localStorage から背景画像プレビューを初期化
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BG_LS_KEY);
      if (stored) setBgPreview(stored);
    } catch {
      // localStorage 使用不可の場合はスキップ
    }
  }, []);

  useEffect(() => {
    if (deleteDialogOpen) {
      setTimeout(() => deletePasswordRef.current?.focus(), 50);
    }
  }, [deleteDialogOpen]);

  // ───── ハンドラー ─────
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

  const handleTestNotif = async () => {
    setTestNotifResult(null);
    setTestNotifLoading(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setTestNotifResult(
          `失敗: ${data.error ?? "不明なエラー"}${data.errors?.length ? ` (${data.errors.join(", ")})` : ""}`
        );
      } else {
        setTestNotifResult(
          `送信成功: ${data.sent}件 / 購読数 ${data.subscriptionCount}件`
        );
      }
    } catch {
      setTestNotifResult("失敗: 通信エラー");
    } finally {
      setTestNotifLoading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinedAt: joinedAt || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error ?? "保存に失敗しました");
      } else {
        setProfile(data);
        setJoinedAt(data.joinedAt ?? "");
        setProfileSuccess("プロフィールを保存しました");
      }
    } catch {
      setProfileError("通信エラー");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFiscalError("");
    setFiscalSuccess("");
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
        setFiscalError(data.error ?? "追加に失敗しました");
      } else {
        setFiscalSuccess(`${newYear}年度を設定しました`);
        setNewDays("");
        loadData();
      }
    } catch {
      setFiscalError("通信エラー");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: number) => {
    setFiscalError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/fiscal-years/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantedDays: Number(editDays) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFiscalError(data.error ?? "更新に失敗しました");
      } else {
        setEditingId(null);
        setFiscalSuccess("更新しました");
        loadData();
      }
    } catch {
      setFiscalError("通信エラー");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, year: number) => {
    if (!confirm(`${year}年度を削除しますか？取得履歴もすべて削除されます。`)) return;
    const res = await fetch(`/api/fiscal-years/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFiscalYears((prev) => prev.filter((f) => f.id !== id));
      setFiscalSuccess("削除しました");
    } else {
      setFiscalError("削除に失敗しました");
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

  // ───── 背景画像ハンドラー ─────
  const handleBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgError("");
    setBgSuccess("");

    if (file.size > 5 * 1024 * 1024) {
      setBgError("ファイルが5MBを超えています。自動的に圧縮して保存します。");
    }

    setBgProcessing(true);
    try {
      const dataUrl = await resizeAndCompress(file);
      localStorage.setItem(BG_LS_KEY, dataUrl);
      setBgPreview(dataUrl);
      window.dispatchEvent(new Event("bg-changed"));
      setBgSuccess("背景画像を設定しました");
    } catch {
      setBgError("画像の処理に失敗しました。別の画像をお試しください。");
    } finally {
      setBgProcessing(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = "";
    }
  };

  const handleBgReset = () => {
    try {
      localStorage.removeItem(BG_LS_KEY);
    } catch {
      // ignore
    }
    setBgPreview(null);
    setBgError("");
    setBgSuccess("背景画像をデフォルトに戻しました");
    window.dispatchEvent(new Event("bg-changed"));
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

  // ───────────────────────────────────────────
  // レンダリング
  // ───────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? "text-white drop-shadow" : "text-slate-900"}`}>詳細設定</h2>
        <p className={`text-sm mt-0.5 ${isDark ? "text-white/75" : "text-slate-600"}`}>
          通知・入社日・有給年度などの設定を管理します
        </p>
      </div>

      {loading && (
        <div className={`text-center py-8 text-sm ${isDark ? "text-white/70" : "text-slate-500"}`}>読み込み中...</div>
      )}

      {!loading && (
        <div className="space-y-3">
          {/* ── 1. 入社日設定 ── */}
          <AccordionSection
            id="profile"
            icon="👤"
            title="入社日設定"
            description="勤続年数や特別有給の計算に使用します"
            isOpen={openSections.has("profile")}
            onToggle={toggleSection}
          >
            {profile && (
              <div className="mb-4 text-sm text-slate-600 space-y-1 bg-slate-50 rounded-lg px-3 py-2">
                <p>
                  <span className="text-slate-400">名前: </span>
                  {profile.name}
                </p>
                <p>
                  <span className="text-slate-400">メール: </span>
                  {profile.email}
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

              {profileError && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg">
                  {profileSuccess}
                </div>
              )}

              <button type="submit" disabled={profileSaving} className="btn-primary">
                {profileSaving ? "保存中..." : "入社日を保存"}
              </button>
            </form>
          </AccordionSection>

          {/* ── 2. プッシュ通知設定 ── */}
          <AccordionSection
            id="push"
            icon="🔔"
            title="プッシュ通知"
            description="有給取得前日・当日のリマインダー設定"
            isOpen={openSections.has("push")}
            onToggle={toggleSection}
          >
            <form onSubmit={handleNotifSave} className="space-y-4">
              {/* ON/OFF トグル */}
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
                <p className="text-sm font-medium text-slate-700 mb-2">
                  この端末の購読状態
                </p>
                <PushNotificationManager />
              </div>

              {/* テスト通知 */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">テスト通知</p>
                <button
                  type="button"
                  onClick={handleTestNotif}
                  disabled={testNotifLoading}
                  className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testNotifLoading ? "送信中..." : "テスト通知を送信"}
                </button>
                {testNotifResult && (
                  <p
                    className={`text-xs mt-2 ${
                      testNotifResult.startsWith("送信成功")
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {testNotifResult}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  購読済みの全端末にテスト通知を即送信します
                </p>
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

              <button type="submit" disabled={notifSaving} className="btn-primary">
                {notifSaving ? "保存中..." : "通知設定を保存"}
              </button>
            </form>
          </AccordionSection>

          {/* ── 3. 有給年度設定 ── */}
          <AccordionSection
            id="fiscal"
            icon="📅"
            title="有給年度設定"
            description="年度ごとの有給取得可能日数を管理します"
            isOpen={openSections.has("fiscal")}
            onToggle={toggleSection}
          >
            {/* 新規追加フォーム */}
            <div className="mb-5">
              <p className="text-sm font-medium text-slate-700 mb-3">年度を追加・更新</p>
              <form onSubmit={handleAdd} className="space-y-3">
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
                      4月始まり（例: 2024年度 = 2024/4〜2025/3）
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

                {fiscalError && (
                  <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                    {fiscalError}
                  </div>
                )}
                {fiscalSuccess && (
                  <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg">
                    {fiscalSuccess}
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

            {/* 設定済み年度一覧 */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700 mb-3">設定済み年度一覧</p>
              {fiscalYears.length === 0 ? (
                <p className="text-sm text-slate-400">設定済みの年度がありません</p>
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
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
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
                                      remaining <= 5 ? "text-red-600" : "text-green-600"
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
                                  setFiscalError("");
                                  setFiscalSuccess("");
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
          </AccordionSection>

          {/* ── 4. 背景画像設定 ── */}
          <AccordionSection
            id="background"
            icon="🖼️"
            title="背景画像設定"
            description="アプリの背景画像をカメラロールから選んで変更できます"
            isOpen={openSections.has("background")}
            onToggle={toggleSection}
          >
            {/* 隠しファイル入力 */}
            <input
              ref={bgFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBgFileChange}
            />

            {/* プレビュー */}
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700 mb-2">現在の背景</p>
              <div
                className="w-full h-32 rounded-xl bg-cover bg-center bg-no-repeat border border-slate-200 overflow-hidden relative"
                style={{
                  backgroundImage: bgPreview
                    ? `url(${bgPreview})`
                    : "url(/background.jpg)",
                }}
              >
                <div className="absolute inset-0 bg-black/20 flex items-end p-2">
                  <span className="text-white text-xs font-medium drop-shadow">
                    {bgPreview ? "カスタム背景" : "デフォルト背景"}
                  </span>
                </div>
              </div>
            </div>

            {/* エラー / 成功メッセージ */}
            {bgError && (
              <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                {bgError}
              </div>
            )}
            {bgSuccess && (
              <div className="mb-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {bgSuccess}
              </div>
            )}

            {/* ボタン群 */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={bgProcessing}
                onClick={() => bgFileInputRef.current?.click()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {bgProcessing ? "処理中..." : "画像を選択"}
              </button>
              {bgPreview && (
                <button
                  type="button"
                  onClick={handleBgReset}
                  className="btn-secondary text-sm"
                >
                  デフォルトに戻す
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              JPEG・PNG・HEIC などの画像ファイルを選択できます。5MB超の場合は自動圧縮します。設定はこの端末のみに適用されます。
            </p>
          </AccordionSection>

          <AccordionSection
            id="account"
            icon="🔐"
            title="アカウント管理"
            description="ログアウトやアカウントの削除などの操作"
            isOpen={openSections.has("account")}
            onToggle={toggleSection}
            danger
          >
            {/* ログアウト */}
            <div className="mb-5">
              <p className="text-sm font-medium text-slate-700 mb-1">ログアウト</p>
              <p className="text-xs text-slate-400 mb-3">
                このデバイスのセッションを終了します
              </p>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="btn-secondary text-sm"
              >
                ログアウト
              </button>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <p className="text-sm font-medium text-slate-700 mb-1">アカウント削除</p>
              <p className="text-sm text-slate-500 mb-3">
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
          </AccordionSection>
        </div>
      )}

      {/* ── 削除確認ダイアログ（変更なし）── */}
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
