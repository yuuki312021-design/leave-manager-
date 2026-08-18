"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEAVE_TYPE_LABELS, type LeaveType } from "@/lib/utils";

interface Suggestion {
  id: number;
  calendarId: string;
  eventId: string;
  title: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  status: string;
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/calendar/suggestions")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSuggestions(data);
        } else {
          setError(data.error ?? "取得に失敗しました");
        }
      })
      .catch(() => setError("通信エラーが発生しました"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleReject = async (id: number) => {
    setProcessingId(id);
    try {
      const res = await fetch("/api/calendar/suggestions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "更新に失敗しました");
      } else {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setProcessingId(null);
    }
  };

  const buildRegisterUrl = (s: Suggestion): string => {
    const params = new URLSearchParams({
      suggestionId: String(s.id),
      date: s.startDate,
      title: s.title,
    });
    if (s.isAllDay) {
      params.set("allDay", "true");
    } else {
      if (s.startTime) params.set("startTime", s.startTime);
      if (s.endTime) params.set("endTime", s.endTime);
    }
    return `/register?${params.toString()}`;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">有給取得候補</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Googleカレンダーから取得した予定を有給登録するか確認します
        </p>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400">読み込み中...</div>
      )}

      {!loading && error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      {!loading && suggestions.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-slate-500">現在、承認待ちの有給取得候補はありません。</p>
          <Link href="/settings" className="btn-primary inline-block mt-4">
            設定に戻る
          </Link>
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <div key={s.id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{s.title}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {s.startDate}
                    {s.isAllDay
                      ? "（終日）"
                      : s.startTime && s.endTime
                      ? ` ${s.startTime}〜${s.endTime}`
                      : ""}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    推奨: {" "}
                    {s.isAllDay
                      ? LEAVE_TYPE_LABELS.full
                      : LEAVE_TYPE_LABELS.hourly}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={buildRegisterUrl(s)}
                    className="btn-primary text-sm px-3 py-1.5"
                  >
                    承認
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleReject(s.id)}
                    disabled={processingId === s.id}
                    className="btn-secondary text-sm px-3 py-1.5"
                  >
                    {processingId === s.id ? "処理中..." : "却下"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
