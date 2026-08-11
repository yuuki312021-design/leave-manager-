"use client";

import { usePathname } from "next/navigation";

const AUTH_PATHS = ["/login", "/signup"];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage =
    AUTH_PATHS.includes(pathname) || pathname.startsWith("/auth/");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen pt-14">
      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8">
        {children}
      </div>
    </main>
  );
}
