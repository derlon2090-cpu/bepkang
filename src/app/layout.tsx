import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = { title: "بيبراس وكانجارو | المدرّب الذكي", description: "منصة تدريب عربية للحل البصري" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body><Navbar />{children}</body></html>;
}
