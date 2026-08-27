"use client";

import { useEffect, useState } from "react";
import {
  formatDaysAndHours,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_SHORT,
  LEAVE_TYPE_BADGE,
  type LeaveType,
} from "@/lib/utils";
import { LeaveDaysDisplay } from "@/components/LeaveDaysDisplay";

interface FiscalYear {
  id: number;
  year: number;
  grantedDays: number;
}

interface LeaveRecord {
  id: number;
  date: string;
  type: string;
  hours: number | null;
  startTime: string | null;
  endTime: string | null;
  consumedDays: number;
  note: string | null;
  fiscalYear: { year: number; grantedDays: number };
}

const TYPE_BADGE = LEAVE_TYPE_BADGE;

// 編集フォームの状態
interface EditForm {
  date: string;
  type: LeaveType;
  hours: string;
  startTime: string;
  endTime: string;
  note: string;
}

function EditModal({
  record,
  onClose,
  onSaved,
}: {
  record: LeaveRecord;
  onClose: () => void;
  onSaved: (updated: LeaveRecord) => void;
}) {
  const [form, setForm] = useState<EditForm>({
    date: record.date,
    type: record.type as LeaveType,
    hours: record.hours != null ? String(record.hours) : "",
    startTime: record.startTime ?? "",
    endTime: record.endTime ?? "",
    note: record.note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leave-records/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          type: form.type,
          hours: form.type === "hourly" ? Number(form.hours) : undefined,
          startTime: form.type === "hourly" ? (form.startTime || null) : null,
          endTime: form.type === "hourly" ? (form.endTime || null) : null,
          note: form.note || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      const updated = await res.json();
      // APIレスポンスにfiscalYearが含まれない場合は既存値を引き継ぐ
      onSaved({ ...record, ...updated, fiscalYear: updated.fiscalYear ?? record.fiscalYear });
      onClose();
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">記録を編集</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 取得日 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              取得日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className="input-field w-full"
            />
          </div>

          {/* 種別 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              種別 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as LeaveType, hours: "", startTime: "", endTime: "" })
              }
              className="input-field w-full"
            >
              {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => (
                <option key={t} value={t}>
                  {LEAVE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* 時間給フィールド */}
          {form.type === "hourly" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  時間数（時間） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  step={0.5}
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  required
                  className="input-field w-full"
                  placeholder="例：2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    開始時刻
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    終了時刻
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
              </div>
            </>
          )}

          {/* 備考 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              備考
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="input-field w-full"
              placeholder="任意"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={saving}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editRecord, setEditRecord] = useState<LeaveRecord | null>(null);

  // 年度一覧取得
  useEffect(() => {
    fetch("/api/fiscal-years")
      .then((r) => r.json())
      .then((data: FiscalYear[]) => {
        setFiscalYears(data);
      });
  }, []);

  // 取得履歴取得
  useEffect(() => {
    setLoading(true);
    const url =
      selectedYear === "all"
        ? "/api/leave-records"
        : `/api/leave-records?year=${selectedYear}`;
    fetch(url)
      .then((r) => r.json())
      .then((data: LeaveRecord[]) => {
        setRecords(data);
      })
      .finally(() => setLoading(false));
  }, [selectedYear]);

  const handleDelete = async (id: number) => {
    if (!confirm("この記録を削除しますか？")) return;
    const res = await fetch(`/api/leave-records/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } else {
      alert("削除に失敗しました");
    }
    setDeleteId(null);
  };

  const handleSaved = (updated: LeaveRecord) => {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  // 年度ごとの消化合計（特別有給は通常有給の残日数計算から除外）
  const totalConsumed = records
    .filter((r) => r.type !== "special")
    .reduce((sum, r) => sum + r.consumedDays, 0);
  const specialConsumed = records
    .filter((r) => r.type === "special")
    .reduce((sum, r) => sum + r.consumedDays, 0);

  // 選択年度の付与日数
  const grantedDays =
    selectedYear !== "all"
      ? fiscalYears.find((f) => f.year === selectedYear)?.grantedDays ?? 0
      : null;

  return (
    <div className="space-y-6">
      {editRecord && (
        <EditModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={handleSaved}
        />
      )}

      <div>
        <h2 className="text-2xl font-bold text-slate-800">取得履歴</h2>
        <p className="text-sm text-slate-500 mt-0.5">年度別の有給取得一覧</p>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-slate-600 font-medium">年度：</span>
        <button
          onClick={() => setSelectedYear("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedYear === "all"
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          すべて
        </button>
        {fiscalYears.map((fy) => (
          <button
            key={fy.id}
            onClick={() => setSelectedYear(fy.year)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedYear === fy.year
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {fy.year}年度
          </button>
        ))}
      </div>

      {/* サマリー */}
      {selectedYear !== "all" && grantedDays !== null && (
        <div
          className={`grid gap-3 ${
            specialConsumed > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
          }`}
        >
          <div className="card text-center py-3 border-l-4 border-blue-400">
            <p className="text-xs text-slate-500">付与</p>
            <p className="text-xl font-bold text-slate-700 mt-1">
              {grantedDays}<span className="text-xs font-normal ml-0.5">日</span>
            </p>
          </div>
          <div className="card text-center py-3 border-l-4 border-orange-400">
            <p className="text-xs text-slate-500">取得</p>
            <p className="text-xl font-bold text-slate-700 mt-1">
              {totalConsumed % 1 === 0
                ? totalConsumed
                : totalConsumed.toFixed(3).replace(/\.?0+$/, "")}
              <span className="text-xs font-normal ml-0.5">日</span>
            </p>
          </div>
          <div className="card text-center py-3 border-l-4 border-green-400">
            <p className="text-xs text-slate-500">残</p>
            <p className="text-xl font-bold text-slate-700 mt-1">
              {(() => {
                const r = grantedDays - totalConsumed;
                return r % 1 === 0 ? r : r.toFixed(3).replace(/\.?0+$/, "");
              })()}
              <span className="text-xs font-normal ml-0.5">日</span>
            </p>
          </div>
          {specialConsumed > 0 && (
            <div className="card text-center py-3 border-l-4 border-pink-400">
              <p className="text-xs text-slate-500">特別有給</p>
              <p className="text-xl font-bold text-slate-700 mt-1">
                {specialConsumed}
                <span className="text-xs font-normal ml-0.5">日</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* テーブル */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">読み込み中...</div>
      ) : records.length === 0 ? (
        <div className="card text-center py-10 text-slate-400">
          取得履歴がありません
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {/* デスクトップテーブル */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    取得日
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    種別
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    時間数
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    消化日数
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    年度
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    備考
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, i) => (
                  <tr
                    key={record.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      i % 2 === 0 ? "" : "bg-slate-50/30"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {record.date}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          TYPE_BADGE[record.type as LeaveType]
                        }`}
                      >
                        {LEAVE_TYPE_SHORT[record.type as LeaveType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {record.type === "hourly" && record.hours != null ? (
                        <div>
                          <div>{record.hours}h</div>
                          {record.startTime && record.endTime && (
                            <div className="text-xs text-slate-400">
                              {record.startTime}〜{record.endTime}
                            </div>
                          )}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      <LeaveDaysDisplay
                        value={formatDaysAndHours(
                          record.type === "hourly" ? 0 : record.consumedDays,
                          record.type === "hourly" ? record.hours ?? 0 : 0
                        )}
                        size="sm"
                        className="text-slate-700"
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {record.fiscalYear.year}年度
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                      {record.note ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditRecord(record)}
                          className="btn-secondary"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="btn-danger"
                          disabled={deleteId === record.id}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* モバイルカードリスト */}
          <div className="md:hidden divide-y divide-slate-100">
            {records.map((record) => (
              <div key={record.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700">
                        {record.date}
                      </span>
                      <span
                        className={`badge ${
                          TYPE_BADGE[record.type as LeaveType]
                        }`}
                      >
                        {LEAVE_TYPE_SHORT[record.type as LeaveType]}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {record.fiscalYear.year}年度
                      {record.type === "hourly" && record.hours != null
                        ? ` ・ ${record.hours}時間${record.startTime && record.endTime ? `（${record.startTime}〜${record.endTime}）` : ""}`
                        : ""}
                      {record.note ? ` ・ ${record.note}` : ""}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="font-semibold text-slate-700">
                      <LeaveDaysDisplay
                        value={formatDaysAndHours(
                          record.type === "hourly" ? 0 : record.consumedDays,
                          record.type === "hourly" ? record.hours ?? 0 : 0
                        )}
                        size="sm"
                        className="text-slate-700"
                      />
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      <button
                        onClick={() => setEditRecord(record)}
                        className="btn-secondary"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="btn-danger"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-500">
            計 {records.length} 件 ／ 合計{" "}
            {totalConsumed % 1 === 0
              ? totalConsumed
              : totalConsumed.toFixed(3).replace(/\.?0+$/, "")}{" "}
            日
          </div>
        </div>
      )}
    </div>
  );
}
