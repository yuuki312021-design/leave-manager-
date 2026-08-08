export type LeaveType = "full" | "am_half" | "pm_half" | "hourly";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  full: "全休（1日）",
  am_half: "午前半休（0.5日）",
  pm_half: "午後半休（0.5日）",
  hourly: "時間給",
};

export const LEAVE_TYPE_SHORT: Record<LeaveType, string> = {
  full: "全休",
  am_half: "午前半休",
  pm_half: "午後半休",
  hourly: "時間給",
};

/** 取得種別から消化日数を計算 */
export function calcConsumedDays(type: LeaveType, hours?: number): number {
  switch (type) {
    case "full":
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
