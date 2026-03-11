import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

interface LatestActualRow {
  id: number;
  date: string;
}

interface PredictedInsertRow {
  id: number;
  pm_actual_id: number;
  predicted_for: string;
  pm_predicted: Prisma.Decimal | null;
  predicted_at: Date;
}

const parseNullableNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const mapPredictedRow = (row: PredictedInsertRow) => ({
  id: row.id,
  pm_actual_id: row.pm_actual_id,
  predicted_for: row.predicted_for,
  pm_predicted: row.pm_predicted === null ? null : Number(row.pm_predicted),
  predicted_at:
    row.predicted_at instanceof Date
      ? row.predicted_at.toISOString()
      : String(row.predicted_at),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ locationCode: string }> },
) {
  const { locationCode } = await params;

  if (!locationCode) {
    return NextResponse.json(
      { message: "Missing locationCode" },
      { status: 400 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const actualDateParam = searchParams.get("actual_date");
    const body = (await request.json()) as
      | {
          predicted_for?: string;
          pm_predicted?: number | null;
          predicted_at?: string;
        }[]
      | {
          data?: {
            predicted_for?: string;
            pm_predicted?: number | null;
            predicted_at?: string;
          }[];
        };

    const items = Array.isArray(body) ? body : body.data;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { message: "Missing predicted data list" },
        { status: 400 },
      );
    }

    for (const item of items) {
      if (!item.predicted_for) {
        return NextResponse.json(
          { message: "Each predicted item requires predicted_for" },
          { status: 400 },
        );
      }
      const pmPredicted = parseNullableNumber(item.pm_predicted);
      if (Number.isNaN(pmPredicted)) {
        return NextResponse.json(
          { message: "One or more pm_predicted values are invalid" },
          { status: 400 },
        );
      }
      if (
        item.predicted_at &&
        Number.isNaN(new Date(item.predicted_at).getTime())
      ) {
        return NextResponse.json(
          { message: "One or more predicted_at values are invalid" },
          { status: 400 },
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const actualRows = await tx.$queryRaw<LatestActualRow[]>(Prisma.sql`
        SELECT
          a.id,
          DATE_FORMAT(a.date, '%Y-%m-%d') AS date
        FROM pm_actual a
        INNER JOIN location l ON l.id = a.location_id
        WHERE l.code = ${locationCode}
          ${
            actualDateParam
              ? Prisma.sql`AND a.date = CAST(${actualDateParam} AS DATE)`
              : Prisma.empty
          }
        ORDER BY a.date DESC
        LIMIT 1
      `);

      const latestActual = actualRows[0];
      if (!latestActual) return { kind: "not_found" as const };

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM pm_prediction
        WHERE pm_actual_id = ${latestActual.id}
      `);

      const insertedRows: PredictedInsertRow[] = [];

      for (const item of items) {
        const pmPredicted = parseNullableNumber(item.pm_predicted);
        const predictedAt = item.predicted_at
          ? new Date(item.predicted_at)
          : new Date();

        // แก้: ลบ RETURNING ออก ใช้ executeRaw + LAST_INSERT_ID() แทน
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO pm_prediction (
            pm_actual_id,
            predicted_for,
            pm_predicted,
            predicted_at
          )
          VALUES (
            ${latestActual.id},
            CAST(${item.predicted_for!} AS DATE),
            ${pmPredicted},
            ${predictedAt}
          )
        `);

        const rows = await tx.$queryRaw<PredictedInsertRow[]>(Prisma.sql`
          SELECT
            id,
            pm_actual_id,
            DATE_FORMAT(predicted_for, '%Y-%m-%d') AS predicted_for,
            pm_predicted,
            predicted_at
          FROM pm_prediction
          WHERE id = LAST_INSERT_ID()
        `);

        insertedRows.push(rows[0]);
      }

      return { kind: "ok" as const, latestActual, insertedRows };
    });

    if (result.kind === "not_found") {
      return NextResponse.json(
        { message: "No actual record found for this location" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        locationCode,
        actual: result.latestActual,
        data: result.insertedRows.map(mapPredictedRow),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create predicted pollution records", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2010"
    ) {
      const dbCode = (error.meta as { code?: string } | undefined)?.code;
      if (dbCode === "1062") {
        // MySQL duplicate entry code
        return NextResponse.json(
          {
            message:
              "Predicted record already exists for the latest actual and predicted_for date",
          },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      { message: "Unable to create predicted pollution records" },
      { status: 500 },
    );
  }
}
