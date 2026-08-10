export type LeaveType = "full" | "am_half" | "pm_half" | "hourly" | "special";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  full: "全休（1日）",
  am_half: "午前半休（0.5日）",
  pm_half: "午後半休（0.5日）",
  hourly: "時間給",
  special: "特別有給休暇（2日）",
};

export const LEAVE_TYPE_SHORT: Record<LeaveType, string> = {
  full: "全休",
  am_half: "午前半休",
  pm_half: "午後半休",
  hourly: "時間給",
  special: "特別有給",
};

export const LEAVE_TYPE_BADGE: Record<LeaveType, string> = {
  full: "bg-blue-100 text-blue-700",
  am_half: "bg-purple-100 text-purple-700",
  pm_half: "bg-indigo-100 text-indigo-700",
  hourly: "bg-amber-100 text-amber-700",
  special: "bg-pink-100 text-pink-700",
};

/** 取得種別から消化日数を計算 */
export function calcConsumedDays(type: LeaveType, hours?: number): number {
  switch (type) {
    case "full":
    case "special":
      return 1;
    case "am_half":
    case "pm_half":
      return 0.5;
    case "hourly":
      return (hours ?? 0) / 8;
    default:
      return 0;
  }
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addYearsLocal(d: Date, years: number): Date {
  return new Date(d.getFullYear() + years, d.getMonth(), d.getDate());
}

/** 入社日から勤続年数（満了年数・月数）を計算 */
export function calcTenure(
  joinedAtStr: string,
  now: Date = new Date()
): { years: number; months: number; text: string } | null {
  const joined = parseLocalDate(joinedAtStr);
  if (isNaN(joined.getTime())) return null;

  let years = now.getFullYear() - joined.getFullYear();
  let months = now.getMonth() - joined.getMonth();
  if (now.getDate() < joined.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  years = Math.max(0, years);
  months = Math.max(0, months);

  return {
    years,
    months,
    text: `入社${years}年${months}ヶ月`,
  };
}

export interface SpecialLeaveInfo {
  milestone: number;
  anniversaryStart: string;
  anniversaryEnd: string;
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
  isEligible: boolean;
}

/**
 * 特別有給休暇の情報を計算する。
 * 入社5年・10年・15年…の周年を迎えた時点から1年間（周年年度）に2日付与され、
 * 翌周年に繰り越すことはできない。
 */
export function calcSpecialLeaveInfo(
  joinedAtStr: string,
  specialRecords: { date: string; consumedDays: number }[],
  now: Date = new Date()
): SpecialLeaveInfo | null {
  const tenure = calcTenure(joinedAtStr, now);
  if (!tenure) return null;

  const completedYears = tenure.years;
  if (completedYears < 5) return null;

  const milestone = Math.floor(completedYears / 5) * 5;
  const joined = parseLocalDate(joinedAtStr);
  const anniversaryStart = addYearsLocal(joined, milestone);
  const nextMilestoneStart = addYearsLocal(joined, milestone + 1);
  const anniversaryEnd = new Date(nextMilestoneStart.getTime() - 86_400_000);

  const startStr = formatLocalDate(anniversaryStart);
  const endStr = formatLocalDate(anniversaryEnd);

  const usedDays = specialRecords
    .filter((r) => r.date >= startStr && r.date <= endStr)
    .reduce((sum, r) => sum + r.consumedDays, 0);

  const grantedDays = 2;
  return {
    milestone,
    anniversaryStart: startStr,
    anniversaryEnd: endStr,
    grantedDays,
    usedDays,
    remainingDays: Math.max(0, grantedDays - usedDays),
    isEligible: true,
  };
}

/** 年度の判定（4月始まり） */
export function getFiscalYear(date: Date): number {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  return month >= 4 ? year : year - 1;
}

/** 今年度 */
export function getCurrentFiscalYear(): number {
  return getFiscalYear(new Date());
}

/** 日付文字列(YYYY-MM-DD)から年度取得 */
export function getFiscalYearFromDateString(dateStr: string): number {
  const [year, month] = dateStr.split("-").map(Number);
  return month >= 4 ? year : year - 1;
}

/** 年度の開始日・終了日 */
export function getFiscalYearRange(fiscalYear: number): {
  start: string;
  end: string;
} {
  return {
    start: `${fiscalYear}-04-01`,
    end: `${fiscalYear + 1}-03-31`,
  };
}
