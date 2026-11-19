export interface ExternalWeatherResponse {
  latitude: number;
  longitude: number;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    wind_speed_10m: number;
  };
}

export interface ProcessedWeather {
  city: string;
  temperature: number;
  humidity: number;
  isRaining: boolean;
  windSpeed: number;
  deliveryStatus: "SAFE" | "CAUTION" | "HIGH_RISK";
}
