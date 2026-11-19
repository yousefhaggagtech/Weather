import assert from "node:assert/strict";
import test from "node:test";
import { classifyDeliveryRisk } from "../dist/classify-delivery-risk.js";
import { mapWeatherResponse } from "../dist/map-weather-response.js";

const riskCases = [
  { precipitation: 0, windSpeed: 0, expected: "SAFE" },
  { precipitation: 0, windSpeed: 39.99, expected: "SAFE" },
  { precipitation: 0.01, windSpeed: 0, expected: "CAUTION" },
  { precipitation: 9.99, windSpeed: 39.99, expected: "CAUTION" },
  { precipitation: 10, windSpeed: 0, expected: "HIGH_RISK" },
  { precipitation: 11, windSpeed: 0, expected: "HIGH_RISK" },
  { precipitation: 0, windSpeed: 40, expected: "HIGH_RISK" },
  { precipitation: 0, windSpeed: 41, expected: "HIGH_RISK" },
  { precipitation: 1, windSpeed: 40, expected: "HIGH_RISK" },
  { precipitation: 10, windSpeed: 40, expected: "HIGH_RISK" },
];

for (const { precipitation, windSpeed, expected } of riskCases) {
  test(`${precipitation} mm rain and ${windSpeed} km/h wind: ${expected}`, () => {
    assert.equal(classifyDeliveryRisk(precipitation, windSpeed), expected);
  });
}

function makeResponse(precipitation, windSpeed) {
  return {
    latitude: 30.0444,
    longitude: 31.2357,
    current: {
      time: "2026-11-19T12:00",
      temperature_2m: 23.5,
      relative_humidity_2m: 65,
      precipitation,
      wind_speed_10m: windSpeed,
    },
  };
}

test("maps API fields and the supplied city without modifying the response", () => {
  const data = makeResponse(2.5, 12);
  const original = structuredClone(data);
  Object.freeze(data.current);
  Object.freeze(data);

  const result = mapWeatherResponse(data, "Alexandria");

  assert.deepEqual(result, {
    city: "Alexandria",
    temperature: 23.5,
    humidity: 65,
    windSpeed: 12,
    isRaining: true,
    deliveryStatus: "CAUTION",
  });
  assert.deepEqual(data, original);
  assert.deepEqual(mapWeatherResponse(data, "Alexandria"), result);
  assert.notStrictEqual(mapWeatherResponse(data, "Alexandria"), result);
});

test("maps rainfall and delivery status across all risk boundaries", () => {
  for (const { precipitation, windSpeed, expected } of riskCases) {
    const result = mapWeatherResponse(makeResponse(precipitation, windSpeed), "Cairo");

    assert.equal(result.isRaining, precipitation > 0);
    assert.equal(result.deliveryStatus, expected);
  }
});

test("preserves zero values, negative temperatures, and an empty city", () => {
  const data = makeResponse(0, 0);
  data.current.temperature_2m = -5;
  data.current.relative_humidity_2m = 0;

  assert.deepEqual(mapWeatherResponse(data, ""), {
    city: "",
    temperature: -5,
    humidity: 0,
    windSpeed: 0,
    isRaining: false,
    deliveryStatus: "SAFE",
  });
});
