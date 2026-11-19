const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const CURRENT_WEATHER_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
  "wind_speed_10m",
] as const;

export function buildWeatherUrl(latitude: number, longitude: number): URL {
  const url = new URL(FORECAST_ENDPOINT);
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: CURRENT_WEATHER_VARIABLES.join(","),
  }).toString();

  return url;
}
