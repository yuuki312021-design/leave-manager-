"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentFiscalYear, LEAVE_TYPE_SHORT, type LeaveType } from "@/lib/utils";

interface FiscalYear {
  id: number;
  year: number;
  grantedDays: number;
  leaveRecords: {
    consumedDays: number;
    type: string;
  }[];
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

function SummaryCard({
  label,
  value,
  unit,
  color,
  sub,
  textColor,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  sub?: string;
  textColor?: string;
}) {
  return (
    <div className={`card border-l-4 ${color}`}>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${textColor ?? "text-slate-800"}`}>{value}</span>
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

/** 今日・明日の予定バナー */
function ScheduleBanner({
  label,
  records,
  color,
}: {
  label: string;
  records: LeaveRecord[];
  color: string;
}) {
  if (records.length === 0) return null;
  return (
    <div className={`rounded-xl border-l-4 ${color} bg-white shadow-sm p-4`}>
      <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
      <ul className="space-y-1">
        {records.map((r) => {
          const timeStr =
            r.type === "hourly" && r.hours != null
              ? ` ・ ${r.hours}時間${r.startTime && r.endTime ? `（${r.startTime}〜${r.endTime}）` : ""}`
              : "";
          return (
            <li key={r.id} className="text-sm text-slate-600 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-current opacity-60 flex-shrink-0" />
              <span>
                {LEAVE_TYPE_SHORT[r.type as LeaveType]}
                {timeStr}
                {r.note ? ` ／ ${r.note}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function DashboardPage() {
  const currentYear = getCurrentFiscalYear();
  const [fiscalYear, setFiscalYear] = useState<FiscalYear | null>(null);
  const [recentRecords, setRecentRecords] = useState<LeaveRecord[]>([]);
  const [todayRecords, setTodayRecords] = useState<LeaveRecord[]>([]);
  const [tomorrowRecords, setTomorrowRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fyRes, recRes] = await Promise.all([
          fetch("/api/fiscal-years"),
          fetch(`/api/leave-records?year=${currentYear}`),
        ]);
        const fyList: FiscalYear[] = await fyRes.json();
        const records: LeaveRecord[] = await recRes.json();

        const current = fyList.find((f) => f.year === currentYear) ?? null;
        setFiscalYear(current);
        setRecentRecords(records.slice(0, 5));

        // 今日・明日の予定を抽出
        const today = todayStr();
        const tomorrow = tomorrowStr();
        setTodayRecords(records.filter((r) => r.date === today));
        setTomorrowRecords(records.filter((r) => r.date === tomorrow));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentYear]);

  const totalConsumed =
    fiscalYear?.leaveRecords.reduce((sum, r) => sum + r.consumedDays, 0) ?? 0;
  const remaining = (fiscalYear?.grantedDays ?? 0) - totalConsumed;

  // 種別ごとの集計
  const typeBreakdown = fiscalYear?.leaveRecords.reduce(
    (acc, r) => {
      acc[r.type as LeaveType] = (acc[r.type as LeaveType] ?? 0) + r.consumedDays;
      return acc;
    },
    {} as Partial<Record<LeaveType, number>>
  ) ?? ({} as Partial<Record<LeaveType, number>>);

  const usageRate =
    fiscalYear && fiscalYear.grantedDays > 0
      ? Math.min(100, (totalConsumed / fiscalYear.grantedDays) * 100)
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">ダッシュボード</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {currentYear}年度（{currentYear}/4/1 〜 {currentYear + 1}/3/31）
          </p>
        </div>
        <Link href="/register" className="btn-primary text-sm">
          + 有給登録
        </Link>
      </div>

      {/* 今日・明日の予定バナー */}
      <ScheduleBanner
        label={`今日の予定（${todayStr()}）`}
        records={todayRecords}
        color="border-orange-400"
      />
      <ScheduleBanner
        label={`明日の予定（${tomorrowStr()}）`}
        records={tomorrowRecords}
        color="border-blue-400"
      />

      {!fiscalYear ? (
        <div className="card text-center py-10">
          <p className="text-slate-500 mb-4">
            {currentYear}年度の付与日数がまだ設定されていません
          </p>
          <Link href="/settings" className="btn-primary inline-block">
            年度設定へ
          </Link>
        </div>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              label="付与日数"
              value={fiscalYear.grantedDays}
              unit="日"
              color="border-blue-400"
            />
            <SummaryCard
              label="取得日数"
              value={Number(totalConsumed.toFixed(2))}
              unit="日"
              color="border-orange-400"
              sub={`${fiscalYear.leaveRecords.length} 件`}
            />
            <SummaryCard
              label="残日数"
              value={Number(remaining.toFixed(2))}
              unit="日"
              color={
                remaining <= 5 ? "border-red-400" : "border-green-400"
              }
              textColor={remaining <= 10 ? "text-red-500" : undefined}
            />
          </div>

          {/* 使用率バー */}
          <div className="card">
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span className="font-medium">取得率</span>
              <span>{usageRate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  usageRate >= 80
                    ? "bg-red-400"
                    : usageRate >= 50
                    ? "bg-orange-400"
                    : "bg-green-400"
                }`}
                style={{ width: `${usageRate}%` }}
              />
            </div>

            {/* 種別内訳 */}
            {Object.keys(typeBreakdown).length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-600 mb-2">種別内訳</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      "full",
                      "am_half",
                      "pm_half",
                      "hourly",
                    ] as LeaveType[]
                  ).map((type) => {
                    const val = typeBreakdown[type];
                    if (!val) return null;
                    return (
                      <div key={type} className="text-center bg-slate-50 rounded-lg py-2 px-1">
                        <p className="text-xs text-slate-500">
                          {LEAVE_TYPE_SHORT[type]}
                        </p>
                        <p className="text-lg font-semibold text-slate-700 mt-0.5">
                          {val % 1 === 0 ? val : val.toFixed(3).replace(/\.?0+$/, "")}
                          <span className="text-xs font-normal ml-0.5">日</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 直近の取得履歴 */}
          {recentRecords.length > 0 && (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700">直近の取得</h3>
                <Link
                  href="/history"
                  className="text-sm text-blue-600 hover:underline"
                >
                  すべて見る →
                </Link>
              </div>
              <div className="space-y-2">
                {recentRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <span className="text-sm font-medium text-slate-700">
                        {record.date}
                      </span>
                      <span className="ml-3 text-xs text-slate-500">
                        {LEAVE_TYPE_SHORT[record.type as LeaveType]}
                        {record.type === "hourly" && record.hours != null
                          ? `（${record.hours}時間${record.startTime && record.endTime ? ` ${record.startTime}〜${record.endTime}` : ""}）`
                          : ""}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      {record.consumedDays % 1 === 0
                        ? record.consumedDays
                        : record.consumedDays.toFixed(3).replace(/\.?0+$/, "")}
                      日
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
