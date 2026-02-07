import type { Metadata } from "next";
import "./globals.css";
import { Open_Sans, Montserrat, Roboto } from "next/font/google";

export const metadata: Metadata = {
  title: "Goalix",
  description: "Goalix — цели на неделю, месяц и год",
};

const openSans = Open_Sans({
  subsets: ["latin", "cyrillic"],
  variable: "--font-open-sans",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-montserrat",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${openSans.variable} ${montserrat.variable} ${roboto.variable}`}>
        {children}
      </body>
    </html>
  );
}
