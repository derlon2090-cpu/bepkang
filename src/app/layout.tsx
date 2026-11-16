import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "بيبراس وكانجارو | المدرّب الذكي", description: "منصة تدريب عربية للحل البصري" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
