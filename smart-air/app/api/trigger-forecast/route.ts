import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { runForecastJob } from "@/lib/forecast-trigger";

export const runtime = "nodejs";

const requireAdminAuth = async (request: NextRequest) => {
  const authHeader =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const cookieToken = request.cookies.get("auth_token")?.value;
  const token = bearerToken ?? cookieToken;

  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey && bearerToken === internalKey) {
    return null;
  }

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

    if (payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return null;
  } catch {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }
};

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await runForecastJob();
    return NextResponse.json({ message: "Forecast triggered successfully" });
  } catch (error) {
    console.error("Failed to trigger forecast:", error);
    return NextResponse.json(
      { message: "Unable to run forecast job" },
      { status: 502 },
    );
  }
}
