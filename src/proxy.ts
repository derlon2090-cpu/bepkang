import { NextResponse } from "next/server";
import { auth } from "@/auth";

const protectedPaths = ["/solver", "/train", "/mock-exam"];

export default auth((request) => {
  if (protectedPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)) && !request.auth) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});

export const config = { matcher: ["/solver/:path*", "/train/:path*", "/mock-exam/:path*"] };
