import assert from "node:assert/strict";
import test from "node:test";
import { fetchWeather } from "../dist/fetch-weather.js";
import { makeWeatherResponse } from "./fixtures/weather-response.mjs";

const endpoint = "https://weather.invalid/forecast";

test("weather service awaits fetch and maps a successful JSON response", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    return Response.json(makeWeatherResponse());
  });

  const request = fetchWeather(endpoint, "Cairo");
  assert.ok(request instanceof Promise);
  assert.deepEqual(await request, {
    city: "Cairo",
    temperature: 23.5,
    humidity: 65,
    windSpeed: 12,
    isRaining: false,
    deliveryStatus: "SAFE",
  });
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(fetchMock.mock.calls[0].arguments, [endpoint, { method: "GET" }]);
});

for (const [status, statusText] of [[404, "Not Found"], [503, "Service Unavailable"]]) {
  test(`weather service rejects HTTP ${status} before parsing JSON`, async (t) => {
    const response = new Response("not JSON", { status, statusText });
    const jsonMock = t.mock.method(response, "json", async () => {
      assert.fail("HTTP error bodies must not be parsed as weather data");
    });
    t.mock.method(globalThis, "fetch", async () => response);

    await assert.rejects(fetchWeather(endpoint, "Alexandria"), {
      name: "Error",
      message: `Failed to fetch weather for Alexandria: HTTP ${status} ${statusText}`,
    });
    assert.equal(jsonMock.mock.callCount(), 0);
  });
}

test("weather service propagates a rejected fetch", async (t) => {
  const failure = new TypeError("Network unavailable");
  t.mock.method(globalThis, "fetch", async () => { throw failure; });

  await assert.rejects(fetchWeather(endpoint, "Cairo"), (error) => error === failure);
});

test("weather service rejects invalid JSON syntax", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("{broken JSON"));

  await assert.rejects(fetchWeather(endpoint, "Cairo"), SyntaxError);
});

test("weather service validates parsed JSON before mapping it", async (t) => {
  const invalid = makeWeatherResponse();
  invalid.current.temperature_2m = "23.5";
  t.mock.method(globalThis, "fetch", async () => Response.json(invalid));

  await assert.rejects(fetchWeather(endpoint, "Cairo"), {
    name: "TypeError",
    message: "Invalid weather response: current.temperature_2m must be a finite number.",
  });
});
