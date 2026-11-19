export function makeWeatherResponse() {
  return {
    latitude: 30.0444,
    longitude: 31.2357,
    current: {
      time: "2026-11-19T12:00",
      temperature_2m: 23.5,
      relative_humidity_2m: 65,
      precipitation: 0,
      wind_speed_10m: 12,
    },
  };
}
