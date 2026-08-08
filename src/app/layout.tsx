import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "有給休暇管理",
  description: "有給休暇管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <Navigation />
          {/* デスクトップ：左サイドバー分オフセット */}
          <main className="md:ml-56 min-h-screen pb-20 md:pb-0">
            <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-8">
              {children}
            </div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
