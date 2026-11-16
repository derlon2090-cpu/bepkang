"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const links = [["/solver", "المحلل البصري"], ["/admin/train-model", "تدريب النموذج"], ["/admin/codes", "أكواد الدخول"]] as const;
export function Navbar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <header className="site-navbar"><div className="navbar-inner"><Link href="/" className="navbar-brand"><span>◆</span> بِبراس × كانجارو</Link><nav>{links.map(([href, label]) => <Link key={href} className={pathname.startsWith(href) ? "active" : ""} href={href}>{label}</Link>)}</nav><button className="logout-btn" onClick={() => signOut({ callbackUrl: "/login" })}>تسجيل الخروج</button></div></header>;
}
