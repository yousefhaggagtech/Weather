export interface CityConfig {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

export const CITIES: readonly CityConfig[] = [
  { name: "Cairo", latitude: 30.0444, longitude: 31.2357 },
  { name: "Alexandria", latitude: 31.2001, longitude: 29.9187 },
  { name: "Aswan", latitude: 24.0889, longitude: 32.8998 },
];
