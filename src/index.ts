import { CITIES } from "./cities.js";
import { fetchWeather } from "./fetch-weather.js";
import { buildWeatherUrl } from "./weather-url.js";

const cairo = CITIES.find((city) => city.name === "Cairo");
if (!cairo) {
  throw new Error("Cairo is missing from the city configuration.");
}

const endpoint = buildWeatherUrl(cairo.latitude, cairo.longitude).toString();
const weather = await fetchWeather(endpoint, cairo.name);
console.log(weather);
