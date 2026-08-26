"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  calcMandatoryLeaveDays,
  formatDaysAndHours,
  formatRemainingFromRecords,
  formatConsumedFromRecords,
  getCurrentFiscalYear,
  HALF_DAY_LEAVE_ANNUAL_LIMIT,
  HALF_DAY_LEAVE_REMAINING_RED_THRESHOLD,
  HOURLY_LEAVE_ANNUAL_LIMIT,
  HOURLY_LEAVE_REMAINING_RED_THRESHOLD,
  MANDATORY_LEAVE_DAYS,
  LEAVE_TYPE_SHORT,
  type LeaveType,
} from "@/lib/utils";
import { useBgTheme } from "@/hooks/useBgTheme";

interface FiscalYear {
  id: number;
  year: number;
  grantedDays: number;
  leaveRecords: {
    consumedDays: number;
    type: string;
    hours: number | null;
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

interface UserInfo {
  joinedAt: string | null;
  tenure: { years: number; months: number; text: string } | null;
  specialLeave: {
    milestone: number;
    anniversaryStart: string;
    anniversaryEnd: string;
    grantedDays: number;
    usedDays: number;
    remainingDays: number;
  } | null;
}

interface DashboardData {
  currentYear: number;
  fiscalYear: FiscalYear | null;
  records: LeaveRecord[];
  profile: UserInfo;
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
  value: React.ReactNode;
  unit?: string;
  color: string;
  sub?: string;
  textColor?: string;
}) {
  return (
    <div className={`card border-l-4 ${color}`}>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${textColor ?? "text-slate-800"}`}>{value}</span>
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

/** 2月末有給義務リマインダーバナー（2月〜3月のみ表示） */
function MandatoryLeaveBanner({
  taken,
  required,
}: {
  taken: number;
  required: number;
}) {
  const month = new Date().getMonth() + 1; // 1-12
  if (month < 2 || month > 3) return null;

  const remaining = Math.max(0, required - taken);
  const isMet = taken >= required;

  if (isMet) {
    return (
      <div className="rounded-xl border-l-4 border-green-500 bg-green-50 shadow-sm p-4 flex items-start gap-3">
        <span className="text-green-600 text-lg leading-none mt-0.5">✅</span>
        <p className="text-sm font-semibold text-green-700">
          法定有給{required}日の取得が完了しています（{formatDaysAndHours(taken)}取得済み）
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-l-4 border-red-500 bg-red-50 shadow-sm p-4 flex items-start gap-3">
      <span className="text-red-500 text-lg leading-none mt-0.5">⚠️</span>
      <p className="text-sm font-semibold text-red-700">
        2月末までに法定有給{required}日の取得が必要です。現在{formatDaysAndHours(taken)}取得済み
        {remaining > 0 && `（あと${formatDaysAndHours(remaining)}取得してください）`}
      </p>
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
  const bgTheme = useBgTheme();
  const isDark = bgTheme === "dark";
  const [fiscalYear, setFiscalYear] = useState<FiscalYear | null>(null);
  const [recentRecords, setRecentRecords] = useState<LeaveRecord[]>([]);
  const [todayRecords, setTodayRecords] = useState<LeaveRecord[]>([]);
  const [tomorrowRecords, setTomorrowRecords] = useState<LeaveRecord[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [hourlyHoursTotal, setHourlyHoursTotal] = useState(0);
  const [mandatoryDaysTaken, setMandatoryDaysTaken] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fyRes, recRes, profileRes] = await Promise.all([
          fetch("/api/fiscal-years"),
          fetch(`/api/leave-records?year=${currentYear}`),
          fetch("/api/profile"),
        ]);
        const fyList: FiscalYear[] = await fyRes.json();
        const records: LeaveRecord[] = await recRes.json();
        const userData: UserInfo = await profileRes.json();

        const current = fyList.find((f) => f.year === currentYear) ?? null;
        setFiscalYear(current);
        setRecentRecords(records.slice(0, 5));
        setUserInfo(userData);

        // 時間給の合計時間を集計
        const hourlyTotal = records
          .filter((r) => r.type === "hourly")
          .reduce((sum, r) => sum + (r.hours ?? 0), 0);
        setHourlyHoursTotal(hourlyTotal);

        // 年5日取得義務の取得日数を集計
        setMandatoryDaysTaken(calcMandatoryLeaveDays(records));

        // 今日・明日の予定を抽出（特別有給も含む）
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

  // 通常有給（特別有給は別集計）
  const regularRecords =
    fiscalYear?.leaveRecords.filter((r) => r.type !== "special") ?? [];
  const totalConsumed = regularRecords.reduce((sum, r) => sum + r.consumedDays, 0);
  const remaining = (fiscalYear?.grantedDays ?? 0) - totalConsumed;

  // 半休取得件数（am_half + pm_half の回数）
  const halfDayCount = (fiscalYear?.leaveRecords ?? []).filter(
    (r) => r.type === "am_half" || r.type === "pm_half"
  ).length;
  const halfDayRemaining = Math.max(0, HALF_DAY_LEAVE_ANNUAL_LIMIT - halfDayCount);

  // 時間給取得時間と残り
  const hourlyHoursRemaining = Math.max(0, HOURLY_LEAVE_ANNUAL_LIMIT - hourlyHoursTotal);

  // 年5日取得義務の残り日数
  const mandatoryRemainingDays = Math.max(0, MANDATORY_LEAVE_DAYS - mandatoryDaysTaken);
  const isMandatoryMet = mandatoryDaysTaken >= MANDATORY_LEAVE_DAYS;

  // 種別ごとの集計（特別有給は通常集計から除外）
  const typeBreakdown = regularRecords.reduce(
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
          <h2 className={`text-2xl font-bold ${isDark ? "text-white drop-shadow" : "text-slate-900"}`}>ダッシュボード</h2>
          <p className={`text-sm mt-0.5 ${isDark ? "text-white/75" : "text-slate-600"}`}>
            {currentYear}年度（{currentYear}/4/1 〜 {currentYear + 1}/3/31）
            {userInfo?.tenure && (
              <span className={`ml-2 font-medium ${isDark ? "text-sky-200" : "text-blue-700"}`}>
                {userInfo.tenure.text}
              </span>
            )}
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

      {/* 2月末有給義務リマインダーバナー */}
      <MandatoryLeaveBanner
        taken={mandatoryDaysTaken}
        required={MANDATORY_LEAVE_DAYS}
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
          <div
            className={`grid grid-cols-1 ${
              userInfo?.specialLeave ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4"
            } gap-4`}
          >
            <SummaryCard
              label="付与日数"
              value={formatDaysAndHours(fiscalYear.grantedDays)}
              color="border-blue-400"
            />
            <SummaryCard
              label="取得日数"
              value={formatConsumedFromRecords(
                fiscalYear.leaveRecords.filter((r) => r.type !== "special")
              )}
              color="border-orange-400"
              sub={`${regularRecords.length} 件`}
            />
            <SummaryCard
              label="残日数"
              value={formatRemainingFromRecords(
                fiscalYear.grantedDays,
                fiscalYear.leaveRecords.filter((r) => r.type !== "special")
              )}
              color={remaining <= 10 ? "border-red-400" : "border-green-400"}
              textColor={remaining <= 10 ? "text-red-500" : undefined}
            />
            {userInfo?.specialLeave && (
              <SummaryCard
                label={`特別有給（${userInfo.specialLeave.milestone}周年）`}
                value={formatDaysAndHours(userInfo.specialLeave.remainingDays)}
                color="border-pink-400"
                sub={`${userInfo.specialLeave.anniversaryStart} 〜 ${userInfo.specialLeave.anniversaryEnd}`}
              />
            )}
            <SummaryCard
              label="年5日取得義務"
              value={formatDaysAndHours(mandatoryDaysTaken)}
              color={isMandatoryMet ? "border-green-400" : mandatoryDaysTaken >= MANDATORY_LEAVE_DAYS / 2 ? "border-orange-400" : "border-red-400"}
              textColor={isMandatoryMet ? "text-green-600" : mandatoryDaysTaken >= MANDATORY_LEAVE_DAYS / 2 ? "text-orange-500" : "text-red-500"}
              sub={isMandatoryMet
                ? `/ ${MANDATORY_LEAVE_DAYS}日（達成）`
                : `/ ${MANDATORY_LEAVE_DAYS}日（あと${formatDaysAndHours(mandatoryRemainingDays)}）`}
            />
          </div>

          {/* 時間給・半休サマリーカード */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SummaryCard
              label="時間給 残り時間"
              value={hourlyHoursRemaining}
              unit="時間"
              color={hourlyHoursRemaining <= HOURLY_LEAVE_REMAINING_RED_THRESHOLD ? "border-red-400" : "border-amber-400"}
              textColor={hourlyHoursRemaining <= HOURLY_LEAVE_REMAINING_RED_THRESHOLD ? "text-red-600" : undefined}
              sub={`取得済み ${hourlyHoursTotal}時間 / 上限 ${HOURLY_LEAVE_ANNUAL_LIMIT}時間`}
            />
            <SummaryCard
              label="半休 残り回数"
              value={halfDayRemaining}
              unit="回"
              color={halfDayRemaining <= HALF_DAY_LEAVE_REMAINING_RED_THRESHOLD ? "border-red-400" : "border-purple-400"}
              textColor={halfDayRemaining <= HALF_DAY_LEAVE_REMAINING_RED_THRESHOLD ? "text-red-600" : undefined}
              sub={`取得済み ${halfDayCount}回 / 上限 ${HALF_DAY_LEAVE_ANNUAL_LIMIT}回`}
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
                  remaining <= 10
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
                          {type === "hourly"
                            ? formatDaysAndHours(0, val * 8)
                            : formatDaysAndHours(val)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {/* 半休取得回数 */}
                {halfDayCount > 0 && (
                  <div className={`mt-3 text-xs flex items-center gap-1.5 ${halfDayRemaining === 0 ? "text-red-500" : halfDayRemaining <= 5 ? "text-orange-500" : "text-slate-500"}`}>
                    <span>半休取得回数:</span>
                    <span className="font-semibold">{halfDayCount} 回</span>
                    <span>/</span>
                    <span>{HALF_DAY_LEAVE_ANNUAL_LIMIT} 回 上限</span>
                    <span className="ml-1">（残り {halfDayRemaining} 回）</span>
                  </div>
                )}
                {/* 時間給取得時間 */}
                {hourlyHoursTotal > 0 && (
                  <div className={`mt-2 text-xs flex items-center gap-1.5 ${hourlyHoursRemaining === 0 ? "text-red-500" : hourlyHoursRemaining <= 5 ? "text-orange-500" : "text-slate-500"}`}>
                    <span>時間給取得時間:</span>
                    <span className="font-semibold">{hourlyHoursTotal} 時間</span>
                    <span>/</span>
                    <span>{HOURLY_LEAVE_ANNUAL_LIMIT} 時間 上限</span>
                    <span className="ml-1">（残り {hourlyHoursRemaining} 時間）</span>
                  </div>
                )}
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
                      {formatDaysAndHours(record.consumedDays)}
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
