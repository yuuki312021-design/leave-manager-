"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  calcMandatoryLeaveDays,
  calcSpecialLeaveInfo,
  getCurrentFiscalYear,
  HALF_DAY_LEAVE_ANNUAL_LIMIT,
  HOURLY_LEAVE_ANNUAL_LIMIT,
  MANDATORY_LEAVE_DAYS,
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
  hours?: number | null;
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

interface LeaveDraft {
  id: number;
  userId: number;
  date: string;
  type: LeaveType;
  period: string | null;
  startTime: string | null;
  endTime: string | null;
  hours: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
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

export default function RegisterPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="text-slate-400">読み込み中...</div></div>}>
      <RegisterPage />
    </Suspense>
  );
}

function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suggestionId = searchParams.get("suggestionId");
  const initialDate = searchParams.get("date");
  const initialTitle = searchParams.get("title");
  const initialStartTime = searchParams.get("startTime");
  const initialEndTime = searchParams.get("endTime");
  const initialAllDay = searchParams.get("allDay") === "true";

  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [specialRecords, setSpecialRecords] = useState<SpecialRecord[]>([]);
  const [halfDayCountByFYId, setHalfDayCountByFYId] = useState<Record<number, number>>({});
  const [hourlyHoursByFYId, setHourlyHoursByFYId] = useState<Record<number, number>>({});
  const [mandatoryDaysByFYId, setMandatoryDaysByFYId] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [draft, setDraft] = useState<LeaveDraft | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const currentFY = getCurrentFiscalYear();

  const [rows, setRows] = useState<LeaveRow[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/fiscal-years").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/leave-records").then((r) => r.json()),
      fetch("/api/leave/draft").then((r) => r.json()),
    ])
      .then(([fyData, profileData, recordsData, draftData]: [FiscalYear[], Profile, LeaveRecordBasic[], LeaveDraft | null]) => {
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

        // 年度ごとの時間給取得時間を集計
        const hourlyByFY: Record<number, number> = {};
        recordsData.forEach((r) => {
          if (r.type === "hourly") {
            hourlyByFY[r.fiscalYearId] = (hourlyByFY[r.fiscalYearId] ?? 0) + (r.hours ?? 0);
          }
        });
        setHourlyHoursByFYId(hourlyByFY);

        // 年度ごとの年5日取得義務の取得日数を集計
        const mandatoryByFY: Record<number, number> = {};
        fyData.forEach((fy) => {
          mandatoryByFY[fy.id] = calcMandatoryLeaveDays(recordsData, fy.id);
        });
        setMandatoryDaysByFYId(mandatoryByFY);

        const cur = fyData.find((f) => f.year === currentFY);
        const fyId = cur ? String(cur.id) : fyData.length > 0 ? String(fyData[0].id) : "";

        if (draftData?.date) {
          setDraft(draftData);
          setShowDraftBanner(true);
        }

        // suggestionId がある場合は候補内容で自動入力
        if (suggestionId) {
          const date = initialDate ?? today;
          const resolvedFyId = resolveFiscalYearIdStatic(date, fyId, fyData);
          const row: LeaveRow = {
            id: String(++rowCounter),
            date,
            type: initialAllDay ? "full" : "hourly",
            hours: "",
            startTime: initialStartTime ?? "",
            endTime: initialEndTime ?? "",
            note: initialTitle ?? "",
            fiscalYearId: resolvedFyId,
          };
          if (row.type === "hourly" && row.startTime && row.endTime) {
            row.hours = calcHoursFromTimeStatic(row.startTime, row.endTime);
          }
          setRows([row]);
        } else {
          setRows([createRow(today, fyId)]);
        }
      })
      .finally(() => setLoading(false));
  }, [currentFY, today, suggestionId, initialDate, initialTitle, initialStartTime, initialEndTime, initialAllDay]);

  const specialLeave = profile?.joinedAt
    ? calcSpecialLeaveInfo(profile.joinedAt, specialRecords)
    : null;
  const specialLeaveAvailable =
    specialLeave?.isEligible && specialLeave.remainingDays > 0;

  // 今年度の年5日取得義務の状況
  const currentFYData = fiscalYears.find((f) => f.year === currentFY);
  const mandatoryTakenCurrentFY = currentFYData ? (mandatoryDaysByFYId[currentFYData.id] ?? 0) : 0;
  const mandatoryRemainingCurrentFY = Math.max(0, MANDATORY_LEAVE_DAYS - mandatoryTakenCurrentFY);
  const isMandatoryMetCurrentFY = mandatoryTakenCurrentFY >= MANDATORY_LEAVE_DAYS;

  // 年度を日付から自動解決
  const resolveFiscalYearId = (dateStr: string, currentFyId: string): string => {
    const [year, month] = dateStr.split("-").map(Number);
    const fy = month >= 4 ? year : year - 1;
    const matched = fiscalYears.find((f) => f.year === fy);
    return matched ? String(matched.id) : currentFyId;
  };

  // suggestionId 自動入力用（fiscalYears読み込み前に使う静的版）
  function resolveFiscalYearIdStatic(
    dateStr: string,
    currentFyId: string,
    fyList: FiscalYear[]
  ): string {
    const [year, month] = dateStr.split("-").map(Number);
    const fy = month >= 4 ? year : year - 1;
    const matched = fyList.find((f) => f.year === fy);
    return matched ? String(matched.id) : currentFyId;
  }

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

  function calcHoursFromTimeStatic(start: string, end: string): string {
    if (!start || !end) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diffMin = eh * 60 + em - (sh * 60 + sm);
    if (diffMin <= 0) return "";
    const h = diffMin / 60;
    return String(Math.round(h * 10) / 10);
  }

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

    // 時間給の年度上限チェック（フロントエンド、複数行一括送信を考慮）
    const hourlyInSubmit: Record<string, number> = {};
    for (const row of rows) {
      if (row.type === "hourly") {
        hourlyInSubmit[row.fiscalYearId] = (hourlyInSubmit[row.fiscalYearId] ?? 0) + parseFloat(row.hours || "0");
      }
    }
    for (const [fyIdStr, addedHours] of Object.entries(hourlyInSubmit)) {
      const fyId = Number(fyIdStr);
      const existing = hourlyHoursByFYId[fyId] ?? 0;
      if (existing + addedHours > HOURLY_LEAVE_ANNUAL_LIMIT) {
        const fy = fiscalYears.find((f) => f.id === fyId);
        setError(
          `${fy ? fy.year + "年度" : "選択年度"}の時間給が年間上限（${HOURLY_LEAVE_ANNUAL_LIMIT}時間）を超えます（取得済み ${existing} 時間 + 今回 ${addedHours} 時間 = ${existing + addedHours} 時間）`
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

      // 候補からの自動入力の場合、statusをapprovedに更新
      if (suggestionId) {
        await fetch("/api/calendar/suggestions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: Number(suggestionId), status: "approved" }),
        }).catch(() => {});
      }

      // 登録成功時は下書きを削除
      await fetch("/api/leave/draft", { method: "DELETE" }).catch(() => {});
      setDraft(null);
      setShowDraftBanner(false);

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

  const restoreDraft = () => {
    if (!draft) return;
    const fyId = fiscalYears.find((f) => draft.date.startsWith(String(f.year)))?.id
      ? String(fiscalYears.find((f) => draft.date.startsWith(String(f.year)))!.id)
      : rows[0]?.fiscalYearId ?? ""; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    setRows([
      {
        id: String(++rowCounter),
        date: draft.date,
        type: draft.type,
        hours: draft.hours ?? "",
        startTime: draft.startTime ?? "",
        endTime: draft.endTime ?? "",
        note: draft.reason ?? "",
        fiscalYearId: fyId,
      },
    ]);
    setShowDraftBanner(false);
  };

  const discardDraft = async () => {
    try {
      await fetch("/api/leave/draft", { method: "DELETE" });
      setDraft(null);
      setShowDraftBanner(false);
    } catch {
      setError("下書きの破棄に失敗しました");
    }
  };

  const saveDraft = async () => {
    const row = rows[0];
    if (!row || !row.date || !row.type) {
      setError("下書き保存するには取得日と種別を入力してください");
      return;
    }
    setDraftSaving(true);
    setError("");
    try {
      const res = await fetch("/api/leave/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: row.date,
          type: row.type,
          startTime: row.startTime || null,
          endTime: row.endTime || null,
          hours: row.hours || null,
          reason: row.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "下書きの保存に失敗しました");
        return;
      }
      setDraft(data);
      setSuccess("下書きを保存しました");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setDraftSaving(false);
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
          {/* 下書き復元バナー */}
          {showDraftBanner && draft && (
            <div className="max-w-2xl bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-blue-800">
                <p className="font-medium">前回の下書きがあります</p>
                <p className="text-blue-700/80 mt-0.5">
                  {draft.date} / {LEAVE_TYPE_LABELS[draft.type]} / 最終更新: {new Date(draft.updatedAt).toLocaleString("ja-JP")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="btn-primary text-sm px-3 py-1.5"
                >
                  復元
                </button>
                <button
                  type="button"
                  onClick={discardDraft}
                  className="btn-secondary text-sm px-3 py-1.5"
                >
                  破棄
                </button>
              </div>
            </div>
          )}

          {/* 今年度の年5日取得義務 進捗バナー */}
          {currentFYData && (
            <div className={`max-w-2xl flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border ${
              isMandatoryMetCurrentFY
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-orange-50 text-orange-700 border-orange-200"
            }`}>
              <span>今年度取得日数:</span>
              <span className="font-semibold">
                {mandatoryTakenCurrentFY % 1 === 0
                  ? mandatoryTakenCurrentFY
                  : mandatoryTakenCurrentFY.toFixed(3).replace(/\.?0+$/, "")} 日 / {MANDATORY_LEAVE_DAYS} 日
              </span>
              {!isMandatoryMetCurrentFY && (
                <span>
                  （あと{mandatoryRemainingCurrentFY % 1 === 0
                    ? mandatoryRemainingCurrentFY
                    : mandatoryRemainingCurrentFY.toFixed(3).replace(/\.?0+$/, "")}日）
                </span>
              )}
              {isMandatoryMetCurrentFY && <span>（達成）</span>}
            </div>
          )}
          {rows.map((row, index) => {
            const fyId = Number(row.fiscalYearId);
            const halfUsed = halfDayCountByFYId[fyId] ?? 0;
            const halfRemaining = HALF_DAY_LEAVE_ANNUAL_LIMIT - halfUsed;
            const isHalfType = row.type === "am_half" || row.type === "pm_half";
            const hourlyUsed = hourlyHoursByFYId[fyId] ?? 0;
            const hourlyRemaining = HOURLY_LEAVE_ANNUAL_LIMIT - hourlyUsed;

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
                            {Math.ceil(parseFloat(row.hours) / 8)}{" "}
                            日分
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* 時間給残り時間表示 */}
                  {row.type === "hourly" && (
                    <p className={`text-xs mt-1 font-medium ${hourlyRemaining <= 0 ? "text-red-500" : hourlyRemaining <= 5 ? "text-orange-500" : "text-amber-600"}`}>
                      今年度残り {Math.max(0, hourlyRemaining)} 時間（取得済み {hourlyUsed} 時間 / 上限 {HOURLY_LEAVE_ANNUAL_LIMIT} 時間）
                    </p>
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
              onClick={saveDraft}
              disabled={draftSaving || rows.some((r) => !r.date || !r.type)}
              className="btn-secondary"
            >
              {draftSaving ? "保存中..." : "下書き保存"}
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
