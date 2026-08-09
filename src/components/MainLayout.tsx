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
    <main className="md:ml-56 min-h-screen pb-20 md:pb-0">
      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8">
        {children}
      </div>
    </main>
  );
}
