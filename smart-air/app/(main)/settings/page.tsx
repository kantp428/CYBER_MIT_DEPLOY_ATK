"use client";

import * as React from "react";

import { FilterDropdown } from "@/components/pollution/filter-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocationOptions } from "@/hooks/use-location-options";

const toNullableNumber = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export default function SettingsPage() {
  const [mounted, setMounted] = React.useState(false);
  const [locationOpen, setLocationOpen] = React.useState(false);
  const [selectedLocations, setSelectedLocations] = React.useState<string[]>(
    [],
  );
  const { data: locationOptions, isLoading: locationLoading } =
    useLocationOptions();

  const [date, setDate] = React.useState("");
  const [pm, setPm] = React.useState("");
  const [temp, setTemp] = React.useState("");
  const [dewPoint, setDewPoint] = React.useState("");
  const [humidity, setHumidity] = React.useState("");
  const [pressure, setPressure] = React.useState("");
  const [windSpeed, setWindSpeed] = React.useState("");
  const [precipitation, setPrecipitation] = React.useState("");
  const [windDirection, setWindDirection] = React.useState("");
  const [fetchedAt, setFetchedAt] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleLocation = (value: string) => {
    setSelectedLocations((current) =>
      current.includes(value) ? [] : [value],
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const locationId = selectedLocations[0];
    if (!locationId) {
      setError("กรุณาเลือกจังหวัดก่อน");
      return;
    }

    if (!date) {
      setError("กรุณาเลือกวันที่");
      return;
    }

    const payload = {
      date,
      pm: toNullableNumber(pm),
      temp: toNullableNumber(temp),
      dew_point: toNullableNumber(dewPoint),
      humidity: toNullableNumber(humidity),
      pressure: toNullableNumber(pressure),
      wind_speed: toNullableNumber(windSpeed),
      precipitation: toNullableNumber(precipitation),
      wind_direction: toNullableNumber(windDirection),
      fetched_at: fetchedAt || null,
    };

    const numericValues = Object.values(payload).filter(
      (value) => typeof value === "number",
    ) as number[];
    const hasInvalidNumber = numericValues.some((value) => Number.isNaN(value));
    if (hasInvalidNumber) {
      setError("มีช่องตัวเลขที่กรอกไม่ถูกต้อง");
      return;
    }
    const hasNegativeNumber = numericValues.some((value) => value < 0);
    if (hasNegativeNumber) {
      setError("ห้ามกรอกค่าติดลบ");
      return;
    }

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
        setIsSubmitting(false);
        return;
      }

      setSuccess("บันทึกข้อมูลสำเร็จ");
      setIsSubmitting(false);
    } catch {
      setError("บันทึกข้อมูลไม่สำเร็จ");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          บันทึกข้อมูล PM actual สำหรับจังหวัดที่เลือก
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
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
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="date">
              Date
            </label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="pm">
              PM
            </label>
            <Input
              id="pm"
              type="number"
              min="0"
              step="0.01"
              value={pm}
              onChange={(event) => setPm(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="temp">
              Temp
            </label>
            <Input
              id="temp"
              type="number"
              min="0"
              step="0.01"
              value={temp}
              onChange={(event) => setTemp(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dew_point">
              Dew Point
            </label>
            <Input
              id="dew_point"
              type="number"
              min="0"
              step="0.01"
              value={dewPoint}
              onChange={(event) => setDewPoint(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="humidity">
              Humidity
            </label>
            <Input
              id="humidity"
              type="number"
              min="0"
              step="0.01"
              value={humidity}
              onChange={(event) => setHumidity(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="pressure">
              Pressure
            </label>
            <Input
              id="pressure"
              type="number"
              min="0"
              step="0.01"
              value={pressure}
              onChange={(event) => setPressure(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="wind_speed">
              Wind Speed
            </label>
            <Input
              id="wind_speed"
              type="number"
              min="0"
              step="0.01"
              value={windSpeed}
              onChange={(event) => setWindSpeed(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="precipitation">
              Precipitation
            </label>
            <Input
              id="precipitation"
              type="number"
              min="0"
              step="0.01"
              value={precipitation}
              onChange={(event) => setPrecipitation(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="wind_direction">
              Wind Direction
            </label>
            <Input
              id="wind_direction"
              type="number"
              min="0"
              step="0.01"
              value={windDirection}
              onChange={(event) => setWindDirection(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="fetched_at">
              Fetched At
            </label>
            <Input
              id="fetched_at"
              type="datetime-local"
              value={fetchedAt}
              onChange={(event) => setFetchedAt(event.target.value)}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-green-600">{success}</p> : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </Button>
      </form>
    </div>
  );
}
