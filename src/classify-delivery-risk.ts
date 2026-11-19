import type { ProcessedWeather } from "./weather-models.js";

const HIGH_RISK_PRECIPITATION_MM = 10;
const HIGH_RISK_WIND_SPEED_KMH = 40;

// These simplified rules are educational, not real delivery safety standards.
export function classifyDeliveryRisk(
  precipitation: number,
  windSpeed: number,
): ProcessedWeather["deliveryStatus"] {
  if (
    precipitation >= HIGH_RISK_PRECIPITATION_MM ||
    windSpeed >= HIGH_RISK_WIND_SPEED_KMH
  ) {
    return "HIGH_RISK";
  }

  if (precipitation > 0) {
    return "CAUTION";
  }

  return "SAFE";
}
