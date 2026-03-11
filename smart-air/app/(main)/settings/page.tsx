"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { FilterDropdown } from "@/components/pollution/filter-dropdown";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useLocationOptions } from "@/hooks/use-location-options";

// ────────────────────────────────────────────────────────────
// Field config
// ────────────────────────────────────────────────────────────
const FIELD_CONFIG = {
  pm: { label: "PM", min: 0, max: 999, unit: "µg/m³" },
  temp: { label: "Temp", min: 0, max: 60, unit: "°C" },
  dew_point: { label: "Dew Point", min: 0, max: 40, unit: "°C" },
  humidity: { label: "Humidity", min: 0, max: 100, unit: "%" },
  pressure: { label: "Pressure", min: 800, max: 1100, unit: "hPa" },
  wind_speed: { label: "Wind Speed", min: 0, max: 200, unit: "km/h" },
  precipitation: { label: "Precipitation", min: 0, max: 500, unit: "mm" },
  wind_direction: { label: "Wind Direction", min: 0, max: 360, unit: "°" },
} as const;

type FieldKey = keyof typeof FIELD_CONFIG;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
const toNullableNumber = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const validateFields = (values: Record<FieldKey, string>): string | null => {
  for (const key of Object.keys(FIELD_CONFIG) as FieldKey[]) {
    const raw = values[key];
    if (!raw.trim()) continue;

    const num = Number(raw);
    const { label, min, max, unit } = FIELD_CONFIG[key];

    if (!Number.isFinite(num)) {
      return `${label}: กรอกตัวเลขไม่ถูกต้อง`;
    }
    if (num < min) {
      return `${label}: ต้องไม่น้อยกว่า ${min} ${unit}`;
    }
    if (num > max) {
      return `${label}: ต้องไม่เกิน ${max} ${unit}`;
    }
  }
  return null;
};

// ────────────────────────────────────────────────────────────
// Sub-component
// ────────────────────────────────────────────────────────────
function NumericField({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: FieldKey;
  value: string;
  onChange: (v: string) => void;
}) {
  const { label, min, max, unit } = FIELD_CONFIG[fieldKey];
  const num = value.trim() ? Number(value) : null;
  const isInvalid =
    num !== null && (!Number.isFinite(num) || num < min || num > max);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={fieldKey}>
        {label}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          ({min}–{max} {unit})
        </span>
      </label>
      <Input
        id={fieldKey}
        type="number"
        min={min}
        max={max}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(isInvalid && "border-red-500 focus-visible:ring-red-500")}
      />
      {isInvalid && (
        <p className="text-xs text-red-500">
          ต้องอยู่ระหว่าง {min}–{max} {unit}
        </p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [mounted, setMounted] = React.useState(false);
  const [locationOpen, setLocationOpen] = React.useState(false);
  const [selectedLocations, setSelectedLocations] = React.useState<string[]>(
    [],
  );
  const { data: locationOptions, isLoading: locationLoading } =
    useLocationOptions();

  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [fields, setFields] = React.useState<Record<FieldKey, string>>({
    pm: "",
    temp: "",
    dew_point: "",
    humidity: "",
    pressure: "",
    wind_speed: "",
    precipitation: "",
    wind_direction: "",
  });
  const [fetchedAt, setFetchedAt] = React.useState<Date | undefined>(undefined);
  const [fetchedAtTime, setFetchedAtTime] = React.useState("00:00");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isPredicting, setIsPredicting] = React.useState(false);
  const [predictMessage, setPredictMessage] = React.useState<string | null>(
    null,
  );
  const [predictLocationOpen, setPredictLocationOpen] =
    React.useState(false);
  const [selectedPredictLocations, setSelectedPredictLocations] =
    React.useState<string[]>([]);
  const [predictDate, setPredictDate] = React.useState<Date | undefined>(
    undefined,
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const setField = (key: FieldKey) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const toggleLocation = (value: string) =>
    setSelectedLocations((current) => (current.includes(value) ? [] : [value]));

  const togglePredictLocation = (value: string) =>
    setSelectedPredictLocations((current) =>
      current.includes(value) ? [] : [value],
    );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPredictMessage(null);

    const locationId = selectedLocations[0];
    if (!locationId) {
      setError("กรุณาเลือกจังหวัดก่อน");
      return;
    }
    if (!date) {
      setError("กรุณาเลือกวันที่");
      return;
    }

    const validationError = validateFields(fields);
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      date: format(date, "yyyy-MM-dd"),
      pm: toNullableNumber(fields.pm),
      temp: toNullableNumber(fields.temp),
      dew_point: toNullableNumber(fields.dew_point),
      humidity: toNullableNumber(fields.humidity),
      pressure: toNullableNumber(fields.pressure),
      wind_speed: toNullableNumber(fields.wind_speed),
      precipitation: toNullableNumber(fields.precipitation),
      wind_direction: toNullableNumber(fields.wind_direction),
      fetched_at: fetchedAt
        ? `${format(fetchedAt, "yyyy-MM-dd")}T${fetchedAtTime}:00`
        : null,
    };

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/pollution/actual/${locationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "บันทึกข้อมูลไม่สำเร็จ");
        return;
      }

      setSuccess("บันทึกข้อมูลสำเร็จ");
    } catch {
      setError("บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePredict = async () => {
    setError(null);
    setSuccess(null);
    setPredictMessage(null);

    const locationId = selectedPredictLocations[0];
    if (!locationId) {
      setPredictMessage("กรุณาเลือกจังหวัดก่อน");
      return;
    }
    if (!predictDate) {
      setPredictMessage("กรุณาเลือกวันที่");
      return;
    }

    try {
      setIsPredicting(true);
      const response = await fetch("/api/pollution/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          locationId,
          date: format(predictDate, "yyyy-MM-dd"),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setPredictMessage(data?.message ?? "ไม่สามารถพยากรณ์ได้");
        return;
      }

      setPredictMessage("พยากรณ์สำเร็จ (สร้าง 7 record ใหม่)");
    } catch {
      setPredictMessage("ไม่สามารถพยากรณ์ได้");
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          บันทึกข้อมูล PM actual และพยากรณ์ PM 2.5
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">บันทึกข้อมูล PM actual</h2>
        <p className="text-sm text-muted-foreground">
          กรอกข้อมูล actual เพื่อใช้เป็นฐานสำหรับการพยากรณ์
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          {/* จังหวัด */}
          <div className="space-y-2">
            <label className="text-sm font-medium">จังหวัด</label>
            <FilterDropdown
              mounted={mounted}
              open={locationOpen}
              onOpenChange={setLocationOpen}
              options={locationOptions}
              selectedValues={selectedLocations}
              onToggle={toggleLocation}
              onClear={() => setSelectedLocations([])}
              placeholder={locationLoading ? "กำลังโหลด..." : "เลือกจังหวัด"}
              searchPlaceholder="ค้นหาจังหวัด..."
              emptyMessage="ไม่พบจังหวัดที่ค้นหา"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Date picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              {mounted ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "เลือกวันที่"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} />
                  </PopoverContent>
                </Popover>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal text-muted-foreground"
                  type="button"
                  disabled
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  เลือกวันที่
                </Button>
              )}
            </div>

            {/* Fetched At */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fetched At</label>
              {mounted ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fetchedAt && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fetchedAt
                        ? `${format(fetchedAt, "PPP")} ${fetchedAtTime}`
                        : "เลือกวันที่และเวลา"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fetchedAt}
                      onSelect={setFetchedAt}
                    />
                    <div className="border-t p-3">
                      <Input
                        type="time"
                        value={fetchedAtTime}
                        onChange={(e) => setFetchedAtTime(e.target.value)}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal text-muted-foreground"
                  type="button"
                  disabled
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  เลือกวันที่และเวลา
                </Button>
              )}
            </div>

            {/* Numeric fields */}
            {(Object.keys(FIELD_CONFIG) as FieldKey[]).map((key) => (
              <NumericField
                key={key}
                fieldKey={key}
                value={fields[key]}
                onChange={setField(key)}
              />
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Predict PM 2.5</h2>
        <p className="text-sm text-muted-foreground">
          ใช้ข้อมูล actual ของวันที่เลือกเพื่อพยากรณ์ 7 วันถัดไป
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">จังหวัด</label>
            <FilterDropdown
              mounted={mounted}
              open={predictLocationOpen}
              onOpenChange={setPredictLocationOpen}
              options={locationOptions}
              selectedValues={selectedPredictLocations}
              onToggle={togglePredictLocation}
              onClear={() => setSelectedPredictLocations([])}
              placeholder={locationLoading ? "กำลังโหลด..." : "เลือกจังหวัด"}
              searchPlaceholder="ค้นหาจังหวัด..."
              emptyMessage="ไม่พบจังหวัดที่ค้นหา"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            {mounted ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !predictDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {predictDate ? format(predictDate, "PPP") : "เลือกวันที่"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={predictDate}
                    onSelect={setPredictDate}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal text-muted-foreground"
                type="button"
                disabled
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                เลือกวันที่
              </Button>
            )}
          </div>
        </div>

        {predictMessage && (
          <p className="mt-3 text-sm text-amber-600">{predictMessage}</p>
        )}

        <div className="mt-4 flex items-center justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handlePredict}
            disabled={isPredicting}
          >
            {isPredicting ? "กำลังพยากรณ์..." : "Predict"}
          </Button>
        </div>
      </div>
    </div>
  );
}
