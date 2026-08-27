"use client";

interface LeaveDaysDisplayProps {
  value: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

type ParsedValue =
  | { kind: "daysHours"; days: number; hours: number }
  | { kind: "days"; days: number }
  | { kind: "hours"; hours: number };

function parseDaysAndHours(value: string): ParsedValue {
  const dayHourMatch = value.match(/^(\d+)日(\d+)時間$/);
  if (dayHourMatch) {
    return {
      kind: "daysHours",
      days: Number(dayHourMatch[1]),
      hours: Number(dayHourMatch[2]),
    };
  }

  const dayMatch = value.match(/^(\d+)日$/);
  if (dayMatch) {
    return { kind: "days", days: Number(dayMatch[1]) };
  }

  const hourMatch = value.match(/^(\d+)時間$/);
  if (hourMatch) {
    return { kind: "hours", hours: Number(hourMatch[1]) };
  }

  // フォールバック: 数値部分だけ抽出して時間として表示
  const fallback = value.match(/(\d+)/);
  return { kind: "hours", hours: fallback ? Number(fallback[1]) : 0 };
}

export function LeaveDaysDisplay({
  value,
  size = "md",
  className,
}: LeaveDaysDisplayProps) {
  const parsed = parseDaysAndHours(value);

  const sizeClasses = {
    sm: {
      number: "text-lg font-semibold",
      unit: "text-sm font-medium ml-0.5",
    },
    md: {
      number: "text-2xl font-bold",
      unit: "text-base font-semibold ml-0.5",
    },
    lg: {
      number: "text-4xl sm:text-5xl font-extrabold tracking-tight",
      unit: "text-xl sm:text-2xl font-bold ml-1",
    },
  };

  const { number: numberClass, unit: unitClass } = sizeClasses[size];

  return (
    <span
      className={["inline-flex items-baseline leading-none", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={value}
    >
      {parsed.kind === "daysHours" && (
        <>
          <span className={numberClass}>{parsed.days}</span>
          <span className={unitClass}>日</span>
          <span className={[numberClass, "ml-1"].join(" ")}>{parsed.hours}</span>
          <span className={unitClass}>時間</span>
        </>
      )}
      {parsed.kind === "days" && (
        <>
          <span className={numberClass}>{parsed.days}</span>
          <span className={unitClass}>日</span>
        </>
      )}
      {parsed.kind === "hours" && (
        <>
          <span className={numberClass}>{parsed.hours}</span>
          <span className={unitClass}>時間</span>
        </>
      )}
    </span>
  );
}
