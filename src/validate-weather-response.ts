import type { ExternalWeatherResponse } from "./weather-models.js";

function assertObject(
  value: unknown,
  field: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Invalid weather response: ${field} must be an object.`);
  }
}

function assertNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(
      `Invalid weather response: ${field} must be a finite number.`,
    );
  }
}

// Interfaces are erased during compilation, so they cannot check external JSON.
// Accept unknown and validate each field before trusting the response's type.
export function validateExternalWeatherResponse(
  response: unknown,
): asserts response is ExternalWeatherResponse {
  assertObject(response, "response");
  assertNumber(response.latitude, "latitude");
  assertNumber(response.longitude, "longitude");
  assertObject(response.current, "current");

  const current = response.current;
  if (typeof current.time !== "string") {
    throw new TypeError(
      "Invalid weather response: current.time must be a string.",
    );
  }

  assertNumber(current.temperature_2m, "current.temperature_2m");
  assertNumber(current.relative_humidity_2m, "current.relative_humidity_2m");
  assertNumber(current.precipitation, "current.precipitation");
  assertNumber(current.wind_speed_10m, "current.wind_speed_10m");
}
