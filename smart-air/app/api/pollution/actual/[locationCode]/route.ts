import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

interface ActualHistoryRow {
  id: number;
  location_id: number;
  date: string;
  pm: Prisma.Decimal | null;
  temp: Prisma.Decimal | null;
  dew_point: Prisma.Decimal | null;
  humidity: number | null;
  pressure: Prisma.Decimal | null;
  wind_speed: Prisma.Decimal | null;
  precipitation: Prisma.Decimal | null;
  wind_direction: Prisma.Decimal | null;
  fetched_at: Date;
}

interface ActualPayload {
  date?: string;
  pm?: number | null;
  temp?: number | null;
  dew_point?: number | null;
  humidity?: number | null;
  pressure?: number | null;
  wind_speed?: number | null;
  precipitation?: number | null;
  wind_direction?: number | null;
  fetched_at?: string;
}

const mapActualRow = (row: ActualHistoryRow) => ({
  id: row.id,
  location_id: row.location_id,
  date: row.date,
  pm: row.pm === null ? null : Number(row.pm),
  temp: row.temp === null ? null : Number(row.temp),
  dew_point: row.dew_point === null ? null : Number(row.dew_point),
  humidity: row.humidity,
  pressure: row.pressure === null ? null : Number(row.pressure),
  wind_speed: row.wind_speed === null ? null : Number(row.wind_speed),
  precipitation: row.precipitation === null ? null : Number(row.precipitation),
  wind_direction:
    row.wind_direction === null ? null : Number(row.wind_direction),
  fetched_at:
    row.fetched_at instanceof Date
      ? row.fetched_at.toISOString()
      : String(row.fetched_at),
  fetched_at:
    row.fetched_at instanceof Date
      ? row.fetched_at.toISOString()
      : String(row.fetched_at),
});

const parseNullableNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const requireAdminAuth = async (request: NextRequest) => {
  const authHeader =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
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

    if (payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return null;
  } catch {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationCode: string }> },
) {
  const authError = await requireAdminAuth(request);
  if (authError) {
    return authError;
  }

  const { locationCode } = await params;

  if (!locationCode) {
    return NextResponse.json(
      { message: "Missing locationCode" },
      { status: 400 },
    );
  }

  try {
    const location =
      (await prisma.location.findUnique({
        where: { code: locationCode },
        select: { id: true, code: true },
      })) ??
      (await prisma.location.findUnique({
        where: { id: Number(locationCode) },
        select: { id: true, code: true },
      }));

    if (!location) {
      return NextResponse.json(
        { message: "Location not found" },
        { status: 404 },
      );
    }

    const rows = await prisma.$queryRaw<ActualHistoryRow[]>(Prisma.sql`
      SELECT
        a.id,
        a.location_id,
        DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
        a.pm,
        a.temp,
        a.dew_point,
        a.humidity,
        a.pressure,
        a.wind_speed,
        a.precipitation,
        a.wind_direction,
        a.fetched_at
      FROM pm_actual a
      INNER JOIN location l ON l.id = a.location_id
      WHERE l.id = ${location.id}
      ORDER BY a.date DESC
      LIMIT 14
    `);

    return NextResponse.json({
      locationCode: location.code,
      data: rows.map(mapActualRow),
    });
  } catch (error) {
    console.error("Failed to load actual pollution history", error);
    return NextResponse.json(
      { message: "Unable to load actual pollution history" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationCode: string }> },
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const { locationCode } = await params;

  if (!locationCode) {
    return NextResponse.json(
      { message: "Missing locationCode" },
      { status: 400 },
    );
  }

  try {
    const payload = (await request.json()) as ActualPayload;

    if (!payload.date) {
      return NextResponse.json(
        { message: "Missing required field: date" },
        { status: 400 },
      );
    }

    const location =
      (await prisma.location.findUnique({
        where: { code: locationCode },
        select: { id: true, code: true },
      })) ??
      (await prisma.location.findUnique({
        where: { id: Number(locationCode) },
        select: { id: true, code: true },
      }));

    if (!location) {
      return NextResponse.json(
        { message: "Location not found" },
        { status: 404 },
      );
    }

    const exists = await prisma.$queryRaw<Array<{ exists_flag: number }>>(
      Prisma.sql`
        SELECT 1 AS exists_flag
        FROM pm_actual
        WHERE location_id = ${location.id}
          AND date = CAST(${payload.date} AS DATE)
        LIMIT 1
      `,
    );

    if (exists.length > 0) {
      return NextResponse.json(
        { message: "มีข้อมูลของจังหวัดและวันที่นี้อยู่แล้ว" },
        { status: 409 },
      );
    }

    const pm = parseNullableNumber(payload.pm);
    const temp = parseNullableNumber(payload.temp);
    const dewPoint = parseNullableNumber(payload.dew_point);
    const humidity = parseNullableNumber(payload.humidity);
    const pressure = parseNullableNumber(payload.pressure);
    const windSpeed = parseNullableNumber(payload.wind_speed);
    const precipitation = parseNullableNumber(payload.precipitation);
    const windDirection = parseNullableNumber(payload.wind_direction);

    if (
      [
        pm,
        temp,
        dewPoint,
        humidity,
        pressure,
        windSpeed,
        precipitation,
        windDirection,
      ].some((v) => Number.isNaN(v))
    ) {
      return NextResponse.json(
        { message: "One or more numeric fields are invalid" },
        { status: 400 },
      );
    }

    const fetchedAt = payload.fetched_at
      ? new Date(payload.fetched_at)
      : new Date();
    if (payload.fetched_at && Number.isNaN(fetchedAt.getTime())) {
      return NextResponse.json(
        { message: "Invalid fetched_at" },
        { status: 400 },
      );
    }

    await prisma.$executeRaw(Prisma.sql`
  INSERT INTO pm_actual (
    location_id, date, pm, temp, dew_point, humidity,
    pressure, wind_speed, precipitation, wind_direction, fetched_at
  )
  VALUES (
    ${location.id},
    CAST(${payload.date} AS DATE),
    ${pm}, ${temp}, ${dewPoint}, ${humidity},
    ${pressure}, ${windSpeed}, ${precipitation}, ${windDirection},
    ${fetchedAt}
  )
`);

    const insertedRows = await prisma.$queryRaw<ActualHistoryRow[]>(Prisma.sql`
      SELECT
        id,
        location_id,
        DATE_FORMAT(date, '%Y-%m-%d') AS date,
        pm, temp, dew_point, humidity, pressure,
        wind_speed, precipitation, wind_direction, fetched_at
      FROM pm_actual
      WHERE location_id = ${location.id}
        AND date = CAST(${payload.date} AS DATE)
      LIMIT 1
`);

    if (!insertedRows[0]) {
      return NextResponse.json(
        { message: "Unable to retrieve created record" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { locationCode: location.code, data: mapActualRow(insertedRows[0]) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create actual pollution record", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2010"
    ) {
      const dbCode = (error.meta as { code?: string } | undefined)?.code;
      if (dbCode === "1062") {
        return NextResponse.json(
          { message: "มีข้อมูลของจังหวัดและวันที่นี้อยู่แล้ว" },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      { message: "Unable to create actual pollution record" },
      { status: 500 },
    );
  }
}
