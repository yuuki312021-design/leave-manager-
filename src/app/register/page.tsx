"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calcSpecialLeaveInfo,
  getCurrentFiscalYear,
  HALF_DAY_LEAVE_ANNUAL_LIMIT,
  LEAVE_TYPE_LABELS,
  type LeaveType,
} from "@/lib/utils";

interface FiscalYear {
  id: number;
  year: number;
  grantedDays: number;
}

interface Profile {
  joinedAt: string | null;
}

interface SpecialRecord {
  date: string;
  consumedDays: number;
}

interface LeaveRecordBasic {
  type: string;
  date: string;
  consumedDays: number;
  fiscalYearId: number;
}

interface LeaveRow {
  id: string; // 行を一意識別するクライアント側のID
  date: string;
  type: LeaveType;
  hours: string;
  startTime: string;
  endTime: string;
  note: string;
  fiscalYearId: string;
}

let rowCounter = 0;
function createRow(today: string, fiscalYearId: string): LeaveRow {
  return {
    id: String(++rowCounter),
    date: today,
    type: "full",
    hours: "",
    startTime: "",
    endTime: "",
    note: "",
    fiscalYearId,
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [specialRecords, setSpecialRecords] = useState<SpecialRecord[]>([]);
  const [halfDayCountByFYId, setHalfDayCountByFYId] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const currentFY = getCurrentFiscalYear();

  const [rows, setRows] = useState<LeaveRow[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/fiscal-years").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/leave-records").then((r) => r.json()),
    ])
      .then(([fyData, profileData, recordsData]: [FiscalYear[], Profile, LeaveRecordBasic[]]) => {
        setFiscalYears(fyData);
        setProfile(profileData);
        setSpecialRecords(
          recordsData.filter((r) => r.type === "special").map((r) => ({ date: r.date, consumedDays: r.consumedDays }))
        );

        // 年度ごとの半休取得件数を集計
        const halfByFY: Record<number, number> = {};
        recordsData.forEach((r) => {
          if (r.type === "am_half" || r.type === "pm_half") {
            halfByFY[r.fiscalYearId] = (halfByFY[r.fiscalYearId] ?? 0) + 1;
          }
        });
        setHalfDayCountByFYId(halfByFY);

        const cur = fyData.find((f) => f.year === currentFY);
        const fyId = cur ? String(cur.id) : fyData.length > 0 ? String(fyData[0].id) : "";
        setRows([createRow(today, fyId)]);
      })
      .finally(() => setLoading(false));
  }, [currentFY, today]);

  const specialLeave = profile?.joinedAt
    ? calcSpecialLeaveInfo(profile.joinedAt, specialRecords)
    : null;
  const specialLeaveAvailable =
    specialLeave?.isEligible && specialLeave.remainingDays > 0;

  // 年度を日付から自動解決
  const resolveFiscalYearId = (dateStr: string, currentFyId: string): string => {
    const [year, month] = dateStr.split("-").map(Number);
    const fy = month >= 4 ? year : year - 1;
    const matched = fiscalYears.find((f) => f.year === fy);
    return matched ? String(matched.id) : currentFyId;
  };

  // 開始・終了時刻から時間数を自動計算
  const calcHoursFromTime = (start: string, end: string): string => {
    if (!start || !end) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diffMin = eh * 60 + em - (sh * 60 + sm);
    if (diffMin <= 0) return "";
    const h = diffMin / 60;
    return String(Math.round(h * 10) / 10);
  };

  // 行を更新するヘルパー
  const updateRow = (id: string, patch: Partial<LeaveRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const handleDateChange = (id: string, dateStr: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return { ...r, date: dateStr, fiscalYearId: resolveFiscalYearId(dateStr, r.fiscalYearId) };
      })
    );
  };

  const handleTypeChange = (id: string, type: LeaveType) => {
    updateRow(id, { type, hours: "", startTime: "", endTime: "" });
  };

  const handleStartTimeChange = (id: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return { ...r, startTime: val, hours: calcHoursFromTime(val, r.endTime) };
      })
    );
  };

  const handleEndTimeChange = (id: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return { ...r, endTime: val, hours: calcHoursFromTime(r.startTime, val) };
      })
    );
  };

  const addRow = () => {
    const lastRow = rows[rows.length - 1];
    const fyId = lastRow ? lastRow.fiscalYearId : (fiscalYears[0] ? String(fiscalYears[0].id) : "");
    setRows((prev) => [...prev, createRow(today, fyId)]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) return; // 最低1行は残す
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    // バリデーション
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.fiscalYearId) {
        setError(`${i + 1}行目: 年度が選択されていません`);
        setSubmitting(false);
        return;
      }
      if (row.type === "hourly") {
        const h = parseFloat(row.hours);
        if (isNaN(h) || h <= 0) {
          setError(`${i + 1}行目: 時間数は1以上の数値を入力してください`);
          setSubmitting(false);
          return;
        }
      }
    }

    // 半休の年度上限チェック（フロントエンド、複数行一括送信を考慮）
    const halfInSubmit: Record<string, number> = {};
    for (const row of rows) {
      if (row.type === "am_half" || row.type === "pm_half") {
        halfInSubmit[row.fiscalYearId] = (halfInSubmit[row.fiscalYearId] ?? 0) + 1;
      }
    }
    for (const [fyIdStr, count] of Object.entries(halfInSubmit)) {
      const fyId = Number(fyIdStr);
      const existing = halfDayCountByFYId[fyId] ?? 0;
      if (existing + count > HALF_DAY_LEAVE_ANNUAL_LIMIT) {
        const fy = fiscalYears.find((f) => f.id === fyId);
        setError(
          `${fy ? fy.year + "年度" : "選択年度"}の半休が年間上限（${HALF_DAY_LEAVE_ANNUAL_LIMIT}回）を超えます（取得済み ${existing} 回 + 今回 ${count} 回 = ${existing + count} 回）`
        );
        setSubmitting(false);
        return;
      }
    }

    try {
      // 1件ずつループで登録
      const results: unknown[] = [];
      for (const row of rows) {
        const payload: Record<string, unknown> = {
          fiscalYearId: Number(row.fiscalYearId),
          date: row.date,
          type: row.type,
          note: row.note || null,
        };
        if (row.type === "hourly") {
          payload.hours = parseFloat(row.hours);
          payload.startTime = row.startTime || null;
          payload.endTime = row.endTime || null;
        }

        const res = await fetch("/api/leave-records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "登録に失敗しました");
          setSubmitting(false);
          return;
        }
        results.push(data);
      }

      const count = results.length;
      setSuccess(
        count === 1 ? "有給取得を登録しました" : `${count}件の有給取得を登録しました`
      );

      // フォームをリセット（1行に戻す）
      const fyId = rows[0]?.fiscalYearId ?? (fiscalYears[0] ? String(fiscalYears[0].id) : "");
      setRows([createRow(today, fyId)]);

      setTimeout(() => router.push("/history"), 1000);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">有給取得登録</h2>
        <p className="text-sm text-slate-500 mt-0.5">新しい有給取得を記録します</p>
      </div>

      {fiscalYears.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-slate-500 mb-4">
            年度設定が必要です。先に年度と付与日数を設定してください。
          </p>
          <a href="/settings" className="btn-primary inline-block">
            年度設定へ
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {rows.map((row, index) => {
            const fyId = Number(row.fiscalYearId);
            const halfUsed = halfDayCountByFYId[fyId] ?? 0;
            const halfRemaining = HALF_DAY_LEAVE_ANNUAL_LIMIT - halfUsed;
            const isHalfType = row.type === "am_half" || row.type === "pm_half";

            return (
              <div key={row.id} className="card max-w-2xl">
                {/* 行ヘッダー */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-slate-600">
                    {rows.length > 1 ? `${index + 1}件目` : "登録内容"}
                  </span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline"
                    >
                      この行を削除
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* 取得日 */}
                  <div>
                    <label className="label">
                      取得日 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      className="input-field"
                      value={row.date}
                      onChange={(e) => handleDateChange(row.id, e.target.value)}
                    />
                  </div>

                  {/* 取得種別 */}
                  <div>
                    <label className="label">
                      取得種別 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {(
                        Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]
                      )
                        .filter(([value]) => value !== "special")
                        .map(([value, label]) => (
                          <label
                            key={value}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                              row.type === value
                                ? "border-blue-500 bg-blue-50"
                                : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`type-${row.id}`}
                              value={value}
                              checked={row.type === value}
                              onChange={() => handleTypeChange(row.id, value)}
                              className="text-blue-600 shrink-0"
                            />
                            <span className="font-medium text-slate-700 leading-tight">
                              {label}
                            </span>
                          </label>
                        ))}
                    </div>
                    {/* 半休残り回数表示 */}
                    {isHalfType && (
                      <p className={`text-xs mt-2 font-medium ${halfRemaining <= 0 ? "text-red-500" : halfRemaining <= 5 ? "text-orange-500" : "text-purple-600"}`}>
                        今年度の半休残り {halfRemaining} 回（取得済み {halfUsed} 回 / 上限 {HALF_DAY_LEAVE_ANNUAL_LIMIT} 回）
                      </p>
                    )}
                    {specialLeaveAvailable && (
                      <label
                        className={`mt-2 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors text-sm ${
                          row.type === "special"
                            ? "border-pink-500 bg-pink-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`type-${row.id}`}
                          value="special"
                          checked={row.type === "special"}
                          onChange={() => handleTypeChange(row.id, "special")}
                          className="text-pink-600 shrink-0"
                        />
                        <span className="font-medium text-slate-700 leading-tight">
                          {LEAVE_TYPE_LABELS.special}
                        </span>
                        <span className="ml-auto text-xs text-pink-600">
                          残 {specialLeave?.remainingDays ?? 0}日
                        </span>
                      </label>
                    )}
                    {profile?.joinedAt && !specialLeaveAvailable && (
                      <p className="text-xs text-slate-400 mt-2">
                        現在、特別有給の取得対象期間ではありません
                      </p>
                    )}
                  </div>

                  {/* 時間給専用フィールド */}
                  {row.type === "hourly" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 開始・終了時刻 */}
                      <div>
                        <label className="label">取得時刻</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            className="input-field"
                            value={row.startTime}
                            onChange={(e) => handleStartTimeChange(row.id, e.target.value)}
                          />
                          <span className="text-slate-400 text-sm whitespace-nowrap">〜</span>
                          <input
                            type="time"
                            className="input-field"
                            value={row.endTime}
                            onChange={(e) => handleEndTimeChange(row.id, e.target.value)}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          ※ 時刻を入力すると時間数が自動計算されます
                        </p>
                      </div>

                      {/* 時間数 */}
                      <div>
                        <label className="label">
                          時間数 <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.5"
                            max="8"
                            step="0.5"
                            required
                            className="input-field"
                            value={row.hours}
                            onChange={(e) => updateRow(row.id, { hours: e.target.value })}
                            placeholder="例: 2"
                          />
                          <span className="text-sm text-slate-500 whitespace-nowrap">時間</span>
                        </div>
                        {row.hours && (
                          <p className="text-xs text-slate-500 mt-1">
                            ={" "}
                            {(parseFloat(row.hours) / 8)
                              .toFixed(3)
                              .replace(/\.?0+$/, "")}{" "}
                            日分
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 年度 */}
                  <div>
                    <label className="label">年度</label>
                    <select
                      className="input-field"
                      value={row.fiscalYearId}
                      onChange={(e) => updateRow(row.id, { fiscalYearId: e.target.value })}
                    >
                      {fiscalYears.map((fy) => (
                        <option key={fy.id} value={fy.id}>
                          {fy.year}年度（付与 {fy.grantedDays} 日）
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                      ※ 取得日から自動選択されます
                    </p>
                  </div>

                  {/* 備考 */}
                  <div>
                    <label className="label">備考</label>
                    <input
                      type="text"
                      className="input-field"
                      value={row.note}
                      onChange={(e) => updateRow(row.id, { note: e.target.value })}
                      placeholder="任意入力"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* もう1件追加ボタン */}
          <div className="max-w-2xl">
            <button
              type="button"
              onClick={addRow}
              className="w-full border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors py-3 rounded-xl text-sm font-medium"
            >
              + もう1件追加
            </button>
          </div>

          {error && (
            <div className="max-w-2xl bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="max-w-2xl bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          <div className="max-w-2xl flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting || rows.some((r) => !r.fiscalYearId)}
              className="btn-primary flex-1"
            >
              {submitting
                ? "登録中..."
                : rows.length === 1
                ? "登録する"
                : `まとめて登録（${rows.length}件）`}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
