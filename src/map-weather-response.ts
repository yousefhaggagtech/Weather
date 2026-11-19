import { classifyDeliveryRisk } from "./classify-delivery-risk.js";
import type {
  ExternalWeatherResponse,
  ProcessedWeather,
} from "./weather-models.js";

// Separate models keep external API field names and changes out of application code.
export function mapWeatherResponse(
  data: ExternalWeatherResponse,
  city: string,
): ProcessedWeather {
  const current = data.current;

  return {
    city,
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    isRaining: current.precipitation > 0,
    deliveryStatus: classifyDeliveryRisk(
      current.precipitation,
      current.wind_speed_10m,
    ),
  };
}
