import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";


export async function GET(request: NextRequest) {
  const authHeader =
    request.headers.get("authorization") ?? request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const cookieToken = request.cookies.get("auth_token")?.value;
  const token = bearerToken ?? cookieToken;

  if (!token) {
    return NextResponse.json({ message: "Missing token" }, { status: 401 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: "JWT secret is not configured" },
      { status: 500 },
    );
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    );

    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    return NextResponse.json({ id: userId, role: payload.role ?? null });
  } catch {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }
}
