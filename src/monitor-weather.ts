import type { CityConfig } from "./cities.js";
import type { ProcessedWeather } from "./weather-models.js";

export interface WeatherFailure {
  city: string;
  message: string;
}

export interface MonitoringResult {
  reports: ProcessedWeather[];
  failures: WeatherFailure[];
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
  };
}

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message;
  }

  if (typeof reason === "string" && reason.trim()) {
    return reason;
  }

  return "Weather request failed with an unknown error.";
}

export async function monitorWeather(
  cities: readonly CityConfig[],
  loadWeather: (city: CityConfig) => Promise<ProcessedWeather>,
): Promise<MonitoringResult> {
  // allSettled waits for every city; all would reject early on one failure.
  const results = await Promise.allSettled(
    cities.map(async (city) => loadWeather(city)),
  );
  const reports: ProcessedWeather[] = [];
  const failures: WeatherFailure[] = [];

  // allSettled preserves input order, regardless of completion order.
  cities.forEach((city, index) => {
    const result = results[index];
    if (result.status === "fulfilled") {
      reports.push(result.value);
    } else {
      const reason: unknown = result.reason;
      failures.push({ city: city.name, message: getErrorMessage(reason) });
    }
  });

  return {
    reports,
    failures,
    summary: {
      totalRequests: results.length,
      successfulRequests: reports.length,
      failedRequests: failures.length,
    },
  };
}
