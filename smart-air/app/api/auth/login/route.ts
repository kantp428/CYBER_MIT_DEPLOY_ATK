import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "");
    const password = String(body?.password || "");
    const account = await prisma.account.findUnique({
      where: { username },
      select: { id: true, username: true, password_hash: true, role: true },
    });

    if (!account) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }

    const isMatch = await bcrypt.compare(password, account.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { message: "JWT secret is not configured" },
        { status: 500 },
      );
    }

    const role = account.role === "ADMIN" ? "admin" : "user";
    const token = await new SignJWT({ role })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(String(account.id))
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(new TextEncoder().encode(secret));

    const response = NextResponse.json({
      token,
      user: { id: String(account.id), username: account.username, role },
    });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 2,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json(
      { message: "Login failed" },
      { status: 500 },
    );
  }
}
