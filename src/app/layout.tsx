import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Providers from "@/components/Providers";
import MainLayout from "@/components/MainLayout";

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
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
