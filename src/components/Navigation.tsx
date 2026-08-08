"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "ダッシュボード", icon: "📊" },
  { href: "/register", label: "取得登録", icon: "✏️" },
  { href: "/history", label: "取得履歴", icon: "📋" },
  { href: "/settings", label: "年度設定", icon: "⚙️" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* デスクトップ用サイドバー */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-slate-200 min-h-screen fixed left-0 top-0">
        <div className="px-5 py-5 border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-800">有給管理</h1>
          <p className="text-xs text-slate-500 mt-0.5">Leave Manager</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* モバイル用ボトムナビ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
        <div className="flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                  isActive ? "text-blue-600" : "text-slate-500"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="leading-tight">
                  {item.label.replace("ダッシュボード", "ホーム")}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
