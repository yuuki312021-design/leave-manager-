"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ADMIN_EMAIL } from "@/lib/utils";

const navItems = [
  { href: "/", label: "ダッシュボード", icon: "📊" },
  { href: "/register", label: "取得登録", icon: "✏️" },
  { href: "/history", label: "取得履歴", icon: "📋" },
  { href: "/settings", label: "詳細設定", icon: "⚙️" },
  { href: "/feedback", label: "フィードバック", icon: "📝" },
];

export default function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth/")
  )
    return null;

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* 固定ヘッダーバー（全画面共通） */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-sm border-b border-slate-200 z-40 flex items-center px-4">
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-label="メニューを開く"
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <line
              x1="3" y1="5" x2="19" y2="5"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
            />
            <line
              x1="3" y1="11" x2="19" y2="11"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
            />
            <line
              x1="3" y1="17" x2="19" y2="17"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
            />
          </svg>
        </button>
        <span className="ml-3 text-base font-bold text-slate-800">有給管理</span>
      </header>

      {/* オーバーレイ（ドロワーが開いているとき） */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* スライドインドロワー */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-slate-200 z-50 flex flex-col shadow-lg transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* ドロワーヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h1 className="text-base font-bold text-slate-800">有給管理</h1>
            <p className="text-xs text-slate-400">Leave Manager</p>
          </div>
          <button
            onClick={closeMenu}
            aria-label="メニューを閉じる"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <line
                x1="3" y1="3" x2="15" y2="15"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              />
              <line
                x1="15" y1="3" x2="3" y2="15"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* ユーザー情報 */}
        {session?.user && (
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400">ログイン中</p>
            <p className="text-sm font-medium text-slate-700 truncate mt-0.5">
              {session.user.name}
            </p>
            <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
          </div>
        )}

        {/* ナビゲーション */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
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

          {/* 管理者専用メニュー */}
          {isAdmin && (
            <>
              <div className="pt-3 pb-1 px-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  管理者
                </span>
              </div>
              <Link
                href="/admin/releases"
                onClick={closeMenu}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/admin/releases"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <span className="text-base">📢</span>
                リリース管理
              </Link>
              <Link
                href="/admin/feedback"
                onClick={closeMenu}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/admin/feedback"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <span className="text-base">📋</span>
                フィードバック管理
              </Link>
            </>
          )}
        </nav>

        {/* ログアウトボタン */}
        <div className="px-3 py-4 border-t border-slate-200">
          <button
            onClick={() => {
              closeMenu();
              signOut({ callbackUrl: "/login" });
            }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <span className="text-base">🚪</span>
            ログアウト
          </button>
        </div>
      </aside>
    </>
  );
}
