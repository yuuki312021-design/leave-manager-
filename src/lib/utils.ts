export type LeaveType = "full" | "am_half" | "pm_half" | "hourly" | "special";

/** 管理者メールアドレス */
export const ADMIN_EMAIL = "yuuki312021@gmail.com";

/** 年度ごとの半休取得上限回数（am_half + pm_half の合計件数） */
export const HALF_DAY_LEAVE_ANNUAL_LIMIT = 20;

/** 半休取得件数を計算（am_half + pm_half の件数） */
export function calcHalfDayLeaveCount(records: { type: string }[]): number {
  return records.filter(
    (r) => r.type === "am_half" || r.type === "pm_half"
  ).length;
}

/** 年度ごとの時間給取得上限時間（5日相当） */
export const HOURLY_LEAVE_ANNUAL_LIMIT = 40;

/** 時間給残り時間がこの値以下になった場合に赤色表示 */
export const HOURLY_LEAVE_REMAINING_RED_THRESHOLD = 8;

/** 半休残り回数がこの値以下になった場合に赤色表示 */
export const HALF_DAY_LEAVE_REMAINING_RED_THRESHOLD = 5;

/** 時間給の合計取得時間を計算 */
export function calcHourlyLeaveHours(
  records: { type: string; hours?: number | null }[]
): number {
  return records
    .filter((r) => r.type === "hourly")
    .reduce((sum, r) => sum + (r.hours ?? 0), 0);
}

/** 年間5日有給取得義務 */
export const MANDATORY_LEAVE_DAYS = 5;

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
      return Math.ceil((hours ?? 0) / 8);
    default:
      return 0;
  }
}

/**
 * 年5日取得義務の対象取得日数を計算（special は対象外）
 * full=1日、am_half/pm_half=0.5日、hourly=8時間ごとに1日
 */
export function calcMandatoryLeaveDays(
  records: { type: string; hours?: number | null; fiscalYearId?: number }[],
  fiscalYearId?: number
): number {
  const filtered =
    fiscalYearId !== undefined
      ? records.filter((r) => r.fiscalYearId === fiscalYearId)
      : records;
  return filtered.reduce((sum, r) => {
    switch (r.type) {
      case "full":
        return sum + 1;
      case "am_half":
      case "pm_half":
        return sum + 0.5;
      case "hourly":
        // 時間休は年5日取得義務のカウントに含めない
        return sum;
      default:
        return sum;
    }
  }, 0);
}

/** 合計時間（時間休）を「日数・残り時間」に変換（8時間=1日） */
export function hoursToDaysHours(totalHours: number): {
  days: number;
  hours: number;
} {
  const days = Math.floor(totalHours / 8);
  const hours = totalHours % 8;
  return { days, hours };
}

/**
 * 日数と時間休の合計時間から「X日Y時間」形式の文字列を生成
 * @param days 終日休・半日休などで換算済みの日数（0.5=半日）
 * @param hourlyHours 時間休の合計時間
 */
export function formatDaysAndHours(
  days: number,
  hourlyHours: number = 0
): string {
  const { days: hoursAsDays, hours } = hoursToDaysHours(hourlyHours);
  const totalDays = days + hoursAsDays;

  if (totalDays === 0) return `${hours}時間`;
  if (hours === 0) return `${totalDays}日`;
  return `${totalDays}日${hours}時間`;
}

/** 取得レコードから合計消化日数を計算（full=1, half=0.5, hourly=8時間ごとに1日） */
export function calcTotalConsumedDays(
  records: { type: string; hours?: number | null; consumedDays?: number }[]
): number {
  return records.reduce((sum, r) => {
    if (r.consumedDays !== undefined && r.consumedDays !== null) {
      return sum + r.consumedDays;
    }
    return sum + calcConsumedDays(r.type as LeaveType, r.hours ?? undefined);
  }, 0);
}

/**
 * 取得レコードから日数（終日・半日・特別）と時間休時間を集計し、
 * 「X日Y時間」形式の文字列で返す
 */
export function formatConsumedFromRecords(
  records: { type: string; hours?: number | null; consumedDays?: number }[]
): string {
  let days = 0;
  let hourlyHours = 0;
  for (const r of records) {
    if (r.type === "hourly") {
      hourlyHours += r.hours ?? 0;
    } else {
      days +=
        r.consumedDays ??
        (r.type === "full" || r.type === "special"
          ? 1
          : r.type === "am_half" || r.type === "pm_half"
          ? 0.5
          : 0);
    }
  }
  return formatDaysAndHours(days, hourlyHours);
}

/**
 * 付与日数と取得レコードから残りを「X日Y時間」形式で返す
 */
export function formatRemainingFromRecords(
  grantedDays: number,
  records: { type: string; hours?: number | null; consumedDays?: number }[]
): string {
  let days = 0;
  let hourlyHours = 0;
  for (const r of records) {
    if (r.type === "hourly") {
      hourlyHours += r.hours ?? 0;
    } else {
      days +=
        r.consumedDays ??
        (r.type === "full" || r.type === "special"
          ? 1
          : r.type === "am_half" || r.type === "pm_half"
          ? 0.5
          : 0);
    }
  }
  const totalRemainingHours = grantedDays * 8 - (days * 8 + hourlyHours);
  return formatDaysAndHours(0, totalRemainingHours);
}

export function formatRemainingDaysOnly(
  grantedDays: number,
  records: { type: string; hours?: number | null; consumedDays?: number }[]
): string {
  let days = 0;
  let hourlyHours = 0;
  for (const r of records) {
    if (r.type === "hourly") {
      hourlyHours += r.hours ?? 0;
    } else {
      days +=
        r.consumedDays ??
        (r.type === "full" || r.type === "special"
          ? 1
          : r.type === "am_half" || r.type === "pm_half"
          ? 0.5
          : 0);
    }
  }
  const totalRemainingHours = Math.max(0, grantedDays * 8 - (days * 8 + hourlyHours));
  const remainingDays = Math.floor(totalRemainingHours / 8);
  return `${remainingDays}日`;
}

export function formatDaysOnly(days: number): string {
  return `${days}日`;
}

/**
 * 取得レコードから合計取得日数（時間休は consumedDays で換算済み）を
 * 「X日」形式の文字列で返す
 */
export function formatConsumedDaysOnly(
  records: { type: string; hours?: number | null; consumedDays?: number }[]
): string {
  return formatDaysOnly(calcTotalConsumedDays(records));
}

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

/** 入社日からの経過年数・月数（0ベース）を計算するプライベートヘルパー */
function calcElapsedYearsMonths(
  joinedAtStr: string,
  now: Date
): { years: number; months: number } | null {
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
  return { years: Math.max(0, years), months: Math.max(0, months) };
}

/** 入社月を0年1か月目として勤続年数・月数を計算 */
export function calcTenure(
  joinedAtStr: string,
  now: Date = new Date()
): { years: number; months: number; text: string } | null {
  const elapsed = calcElapsedYearsMonths(joinedAtStr, now);
  if (!elapsed) return null;

  // 経過月数（0ベース）: 入社月 = 0年1か月目
  const totalMonths = elapsed.years * 12 + elapsed.months;
  const years = Math.floor(totalMonths / 12);
  const months = (totalMonths % 12) + 1;

  return {
    years,
    months,
    text: `入社${years}年${months}ヶ月目`,
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
  // 特別有給の判定には経過年数（0ベース）を使用する（calcTenure の1ベース値とは独立）
  const elapsed = calcElapsedYearsMonths(joinedAtStr, now);
  if (!elapsed) return null;

  const completedYears = elapsed.years;
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
