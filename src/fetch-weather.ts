import { mapWeatherResponse } from "./map-weather-response.js";
import { validateExternalWeatherResponse } from "./validate-weather-response.js";
import type { ProcessedWeather } from "./weather-models.js";

export async function fetchWeather(
  endpoint: string,
  city: string,
): Promise<ProcessedWeather> {
  const response = await fetch(endpoint, { method: "GET" });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch weather for ${city}: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const data: unknown = await response.json();
  validateExternalWeatherResponse(data);

  return mapWeatherResponse(data, city);
}
