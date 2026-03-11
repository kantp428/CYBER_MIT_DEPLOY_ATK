import { SignJWT } from "jose";
import { NextResponse } from "next/server";

const MOCK_USERNAME = "SkyLine";
const MOCK_PASSWORD = "SkyLine2026";
const MOCK_ROLE = "admin";
const MOCK_USER_ID = "1";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "");
    const password = String(body?.password || "");
    const role = String(body?.role || "");

    if (
      username !== MOCK_USERNAME ||
      password !== MOCK_PASSWORD ||
      role !== MOCK_ROLE
    ) {
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

    const token = await new SignJWT({ role })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(MOCK_USER_ID)
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(new TextEncoder().encode(secret));

    return NextResponse.json({
      token,
      user: { id: MOCK_USER_ID, username, role },
    });
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json(
      { message: "Login failed" },
      { status: 500 },
    );
  }
}
