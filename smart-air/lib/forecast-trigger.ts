import { exec } from "child_process";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

export const runForecastJob = async (options?: {
  locationCode?: string;
  endDate?: string;
  actualDate?: string;
}) => {
  const scriptPath =
    process.env.FORECAST_SCRIPT_PATH ??
    path.join(process.cwd(), "forecast", "lab.py");
  const apiKey = process.env.INTERNAL_API_KEY ?? "";
  const apiBaseUrl =
    process.env.FORECAST_API_BASE_URL ?? "http://localhost:4000";

  return execAsync(`python "${scriptPath}"`, {
    env: {
      ...process.env,
      API_KEY: apiKey,
      API_BASE_URL: apiBaseUrl,
      FORECAST_LOCATION_CODE: options?.locationCode ?? "",
      FORECAST_END_DATE: options?.endDate ?? "",
      FORECAST_ACTUAL_DATE: options?.actualDate ?? "",
    },
  });
};
