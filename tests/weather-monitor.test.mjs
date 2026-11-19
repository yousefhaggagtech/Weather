import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { promisify } from "node:util";
import { CITIES } from "../dist/cities.js";
import { fetchWeather } from "../dist/fetch-weather.js";
import { monitorWeather } from "../dist/monitor-weather.js";
import { makeWeatherResponse } from "./fixtures/weather-response.mjs";

const execFileAsync = promisify(execFile);

function makeReport(city) {
  return {
    city: city.name,
    temperature: 23.5,
    humidity: 65,
    windSpeed: 12,
    isRaining: false,
    deliveryStatus: "SAFE",
  };
}

test("monitor starts all requests concurrently and waits for two successes and one failure", {
  timeout: 5_000,
}, async (t) => {
  const pending = new Map();
  t.mock.method(globalThis, "fetch", (endpoint) => new Promise((resolve, reject) => {
    pending.set(new URL(endpoint).searchParams.get("city"), { resolve, reject });
  }));

  let completed = false;
  const request = monitorWeather(CITIES, (city) => fetchWeather(
    `https://weather.invalid/forecast?city=${encodeURIComponent(city.name)}`,
    city.name,
  )).then((result) => {
    completed = true;
    return result;
  });

  assert.deepEqual([...pending.keys()], CITIES.map((city) => city.name));
  pending.get("Alexandria").reject(new TypeError("Network unavailable"));
  pending.get("Aswan").resolve(Response.json(makeWeatherResponse()));
  // Drain a turn without a timing-based sleep while Cairo remains pending.
  await setImmediate();
  assert.equal(completed, false, "one rejection must not finish monitoring early");
  pending.get("Cairo").resolve(Response.json(makeWeatherResponse()));

  assert.deepEqual(await request, {
    reports: [makeReport(CITIES[0]), makeReport(CITIES[2])],
    failures: [{ city: "Alexandria", message: "Network unavailable" }],
    summary: { totalRequests: 3, successfulRequests: 2, failedRequests: 1 },
  });
});

test("monitor counts an all-successful batch", async () => {
  const result = await monitorWeather(CITIES, async (city) => makeReport(city));

  assert.deepEqual(result, {
    reports: CITIES.map(makeReport),
    failures: [],
    summary: { totalRequests: 3, successfulRequests: 3, failedRequests: 0 },
  });
});

test("monitor counts an empty batch without calling the loader", async (t) => {
  const loader = t.mock.fn(() => assert.fail("Empty batches must not request weather"));

  assert.deepEqual(await monitorWeather([], loader), {
    reports: [],
    failures: [],
    summary: { totalRequests: 0, successfulRequests: 0, failedRequests: 0 },
  });
  assert.equal(loader.mock.callCount(), 0);
});

test("monitor counts all failures and normalizes string and unknown rejection reasons", async () => {
  const reasons = [new Error("Service unavailable"), "Connection closed", null];
  const result = await monitorWeather(CITIES, (city) => {
    return Promise.reject(reasons[CITIES.indexOf(city)]);
  });

  assert.deepEqual(result, {
    reports: [],
    failures: [
      { city: "Cairo", message: "Service unavailable" },
      { city: "Alexandria", message: "Connection closed" },
      { city: "Aswan", message: "Weather request failed with an unknown error." },
    ],
    summary: { totalRequests: 3, successfulRequests: 0, failedRequests: 3 },
  });
});

test("monitor handles rejected promises and synchronous loader errors without unhandled rejections", async () => {
  const monitorUrl = new URL("../dist/monitor-weather.js", import.meta.url).href;
  const citiesUrl = new URL("../dist/cities.js", import.meta.url).href;
  // Strict mode makes any unhandled rejection fatal in this isolated process.
  const script = `
    import assert from "node:assert/strict";
    import { setImmediate } from "node:timers/promises";
    import { monitorWeather } from ${JSON.stringify(monitorUrl)};
    import { CITIES } from ${JSON.stringify(citiesUrl)};

    const result = await monitorWeather(CITIES, (city) => {
      if (city.name === "Cairo") return Promise.reject(new Error("Rejected request"));
      if (city.name === "Alexandria") throw new Error("Synchronous failure");
      return Promise.reject("Another rejected request");
    });
    await setImmediate();
    assert.deepEqual(result.reports, []);
    assert.deepEqual(result.failures, [
      { city: "Cairo", message: "Rejected request" },
      { city: "Alexandria", message: "Synchronous failure" },
      { city: "Aswan", message: "Another rejected request" },
    ]);
    assert.deepEqual(result.summary, {
      totalRequests: 3, successfulRequests: 0, failedRequests: 3,
    });
  `;
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    "--unhandled-rejections=strict", "--input-type=module", "--eval", script,
  ], { timeout: 10_000 });

  assert.equal(stdout, "");
  assert.equal(stderr, "");
});
