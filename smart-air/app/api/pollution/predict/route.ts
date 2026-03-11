import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
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
    const body = (await request.json()) as {
      locationId?: number | string;
      date?: string;
    };

    const locationId = Number(body?.locationId);
    const date = String(body?.date || "");

    if (!locationId || Number.isNaN(locationId)) {
      return NextResponse.json(
        { message: "Missing locationId" },
        { status: 400 },
      );
    }
    if (!date) {
      return NextResponse.json({ message: "Missing date" }, { status: 400 });
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true, code: true },
    });
    if (!location) {
      return NextResponse.json(
        { message: "Location not found" },
        { status: 404 },
      );
    }

    const exactActual = await prisma.$queryRaw<
      Array<{ id: number; date: string }>
    >(Prisma.sql`
      SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date
      FROM pm_actual
      WHERE location_id = ${location.id}
        AND date = CAST(${date} AS DATE)
      LIMIT 1
    `);

    const actualDate = exactActual[0]?.date;

    if (!actualDate) {
      return NextResponse.json(
        { message: "ไม่พบข้อมูล actual ของวันที่ที่เลือก" },
        { status: 404 },
      );
    }

    await runForecastJob({
      locationCode: location.code,
      endDate: date,
      actualDate,
    });

    return NextResponse.json({
      message: "Predict triggered",
      locationCode: location.code,
      actualDate,
      predictFrom: date,
    });
  } catch (error) {
    console.error("Failed to trigger predict job", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { message: "Database error" },
        { status: 500 },
      );
    }
    return NextResponse.json({ message: "Unable to run predict" }, { status: 500 });
  }
}
