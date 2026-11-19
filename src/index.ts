import { CITIES } from "./cities.js";
import { fetchWeather } from "./fetch-weather.js";
import { monitorWeather } from "./monitor-weather.js";
import { buildWeatherUrl } from "./weather-url.js";

async function main(): Promise<void> {
  const simulateFailure = process.argv.slice(2).includes("--simulate-failure");
  const { reports, failures, summary } = await monitorWeather(CITIES, (city) => {
    const endpoint = buildWeatherUrl(city.latitude, city.longitude);
    if (simulateFailure && city.name === "Alexandria") {
      endpoint.pathname = "/v1/invalid-forecast";
    }
    return fetchWeather(endpoint.toString(), city.name);
  });

  console.log("Weather Monitoring Report\n");

  for (const weather of reports) {
    console.log(weather.city);
    console.log(`  Temperature: ${weather.temperature} °C`);
    console.log(`  Humidity: ${weather.humidity}%`);
    console.log(`  Wind speed: ${weather.windSpeed} km/h`);
    console.log(`  Raining: ${weather.isRaining ? "Yes" : "No"}`);
    console.log(`  Delivery status: ${weather.deliveryStatus}\n`);
  }

  if (reports.length === 0) {
    console.log("No weather reports available.\n");
  }

  if (failures.length > 0) {
    console.log("Failed requests:");
    for (const failure of failures) {
      console.log(`  ${failure.city}: ${failure.message}`);
    }
    console.log();
  }

  console.log("Summary");
  console.log(`  Total requests: ${summary.totalRequests}`);
  console.log(`  Successful requests: ${summary.successfulRequests}`);
  console.log(`  Failed requests: ${summary.failedRequests}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected error.";
  console.error(`Weather monitoring could not complete: ${message}`);
  process.exitCode = 1;
});
