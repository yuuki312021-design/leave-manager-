"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentFiscalYear,
  LEAVE_TYPE_LABELS,
  type LeaveType,
} from "@/lib/utils";

interface FiscalYear {
  id: number;
  year: number;
  grantedDays: number;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const currentFY = getCurrentFiscalYear();

  const [form, setForm] = useState({
    date: today,
    type: "full" as LeaveType,
    hours: "",
    note: "",
    fiscalYearId: "",
  });

  useEffect(() => {
    fetch("/api/fiscal-years")
      .then((r) => r.json())
      .then((data: FiscalYear[]) => {
        setFiscalYears(data);
        const cur = data.find((f) => f.year === currentFY);
        if (cur) setForm((prev) => ({ ...prev, fiscalYearId: String(cur.id) }));
        else if (data.length > 0)
          setForm((prev) => ({ ...prev, fiscalYearId: String(data[0].id) }));
      })
      .finally(() => setLoading(false));
  }, [currentFY]);

  // 日付変更時に年度を自動選択
  const handleDateChange = (dateStr: string) => {
    const [year, month] = dateStr.split("-").map(Number);
    const fy = month >= 4 ? year : year - 1;
    const matched = fiscalYears.find((f) => f.year === fy);
    setForm((prev) => ({
      ...prev,
      date: dateStr,
      fiscalYearId: matched ? String(matched.id) : prev.fiscalYearId,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        fiscalYearId: Number(form.fiscalYearId),
        date: form.date,
        type: form.type,
        note: form.note || null,
      };
      if (form.type === "hourly") {
        const h = parseFloat(form.hours);
        if (isNaN(h) || h <= 0) {
          setError("時間数は1以上の数値を入力してください");
          setSubmitting(false);
          return;
        }
        payload.hours = h;
      }

      const res = await fetch("/api/leave-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "登録に失敗しました");
      } else {
        setSuccess("有給取得を登録しました");
        setForm({
          date: today,
          type: "full",
          hours: "",
          note: "",
          fiscalYearId: form.fiscalYearId,
        });
        setTimeout(() => router.push("/history"), 1000);
      }
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
        <div className="card max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 取得日 */}
            <div>
              <label className="label" htmlFor="date">
                取得日 <span className="text-red-500">*</span>
              </label>
              <input
                id="date"
                type="date"
                required
                className="input-field"
                value={form.date}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            {/* 取得種別 */}
            <div>
              <label className="label">
                取得種別 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                {(
                  Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.type === value
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={value}
                      checked={form.type === value}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          type: e.target.value as LeaveType,
                          hours: "",
                        }))
                      }
                      className="text-blue-600"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 時間数（時間給のみ） */}
            {form.type === "hourly" && (
              <div>
                <label className="label" htmlFor="hours">
                  時間数 <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="hours"
                    type="number"
                    min="0.5"
                    max="8"
                    step="0.5"
                    required
                    className="input-field"
                    value={form.hours}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, hours: e.target.value }))
                    }
                    placeholder="例: 2"
                  />
                  <span className="text-sm text-slate-500 whitespace-nowrap">
                    時間
                  </span>
                </div>
                {form.hours && (
                  <p className="text-xs text-slate-500 mt-1">
                    = {(parseFloat(form.hours) / 8).toFixed(3).replace(/\.?0+$/, "")} 日分
                  </p>
                )}
              </div>
            )}

            {/* 年度 */}
            <div>
              <label className="label" htmlFor="fiscalYearId">
                年度
              </label>
              <select
                id="fiscalYearId"
                className="input-field"
                value={form.fiscalYearId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fiscalYearId: e.target.value }))
                }
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
              <label className="label" htmlFor="note">
                備考
              </label>
              <input
                id="note"
                type="text"
                className="input-field"
                value={form.note}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="任意入力"
              />
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

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting || !form.fiscalYearId}
                className="btn-primary flex-1"
              >
                {submitting ? "登録中..." : "登録する"}
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
        </div>
      )}
    </div>
  );
}
