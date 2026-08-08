"use client";

import { useEffect, useState } from "react";
import { LEAVE_TYPE_SHORT, type LeaveType } from "@/lib/utils";

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

const TYPE_BADGE: Record<LeaveType, string> = {
  full: "bg-blue-100 text-blue-700",
  am_half: "bg-purple-100 text-purple-700",
  pm_half: "bg-indigo-100 text-indigo-700",
  hourly: "bg-amber-100 text-amber-700",
};

export default function HistoryPage() {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

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

  // 年度ごとの消化合計
  const totalConsumed = records.reduce((sum, r) => sum + r.consumedDays, 0);

  // 選択年度の付与日数
  const grantedDays =
    selectedYear !== "all"
      ? fiscalYears.find((f) => f.year === selectedYear)?.grantedDays ?? 0
      : null;

  return (
    <div className="space-y-6">
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
        <div className="grid grid-cols-3 gap-3">
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
                      {record.consumedDays % 1 === 0
                        ? record.consumedDays
                        : record.consumedDays
                            .toFixed(3)
                            .replace(/\.?0+$/, "")}
                      日
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {record.fiscalYear.year}年度
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                      {record.note ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="btn-danger"
                        disabled={deleteId === record.id}
                      >
                        削除
                      </button>
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
                      {record.consumedDays % 1 === 0
                        ? record.consumedDays
                        : record.consumedDays
                            .toFixed(3)
                            .replace(/\.?0+$/, "")}
                      日
                    </div>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="btn-danger mt-1"
                    >
                      削除
                    </button>
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
