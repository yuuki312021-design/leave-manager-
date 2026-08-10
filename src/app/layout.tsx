import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Providers from "@/components/Providers";
import MainLayout from "@/components/MainLayout";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "有給休暇管理",
  description: "有給休暇の残日数・取得履歴を管理するアプリ",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
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
          <ServiceWorkerRegistration />
          <Navigation />
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
