import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Трекер снижения веса",
  description: "Вес, привычки, простая еда, цель недели и напоминания."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#111111" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
    
        {children}
      </body>
    </html>
  );
}
