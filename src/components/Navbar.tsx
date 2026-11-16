"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export function Navbar() {
  const pathname = usePathname(); const router = useRouter();
  if (pathname === "/login") return null;
  const fresh = () => { if (pathname === "/solver") window.dispatchEvent(new Event("new-puzzle")); else router.push("/solver"); };
  return <header className="site-navbar"><div className="navbar-inner"><Link href="/solver" className="navbar-brand"><span>◆</span> بِبراس × كانجارو</Link><button className="new-chat-btn" onClick={fresh}>＋ محادثة جديدة</button><div className="navbar-spacer" /><span className="user-badge">الطالب</span><button className="logout-btn" onClick={() => signOut({ callbackUrl: "/login" })}>تسجيل الخروج</button></div></header>;
}
