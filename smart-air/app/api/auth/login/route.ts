import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { MOCK_USERS } from "@/lib/mock-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "");
    const password = String(body?.password || "");
    const user = MOCK_USERS.find(
      (mockUser) =>
        mockUser.username === username && mockUser.password === password,
    );

    if (!user) {
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

    const token = await new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(new TextEncoder().encode(secret));

    const response = NextResponse.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
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
