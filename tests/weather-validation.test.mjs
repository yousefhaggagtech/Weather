import assert from "node:assert/strict";
import test from "node:test";
import { validateExternalWeatherResponse } from "../dist/validate-weather-response.js";
import { makeWeatherResponse } from "./fixtures/weather-response.mjs";

test("runtime validation accepts a complete response without changing it", () => {
  const response = makeWeatherResponse();
  const original = structuredClone(response);

  assert.doesNotThrow(() => validateExternalWeatherResponse(response));
  assert.deepEqual(response, original);
});

test("runtime validation rejects non-object JSON responses and current values", () => {
  for (const value of [null, [], "weather", 42, true]) {
    assert.throws(() => validateExternalWeatherResponse(value), {
      name: "TypeError",
      message: "Invalid weather response: response must be an object.",
    });
    assert.throws(
      () => validateExternalWeatherResponse({ ...makeWeatherResponse(), current: value }),
      {
        name: "TypeError",
        message: "Invalid weather response: current must be an object.",
      },
    );
  }
});

const numericFields = [
  ["latitude"],
  ["longitude"],
  ["current", "temperature_2m"],
  ["current", "relative_humidity_2m"],
  ["current", "precipitation"],
  ["current", "wind_speed_10m"],
];

for (const path of numericFields) {
  test(`runtime validation requires a finite number for ${path.join(".")}`, () => {
    // Non-finite numbers can also reach this boundary from custom JSON decoders.
    for (const value of [undefined, null, "12", true, {}, [], NaN, Infinity, -Infinity]) {
      const response = makeWeatherResponse();
      const parent = path.length === 1 ? response : response.current;
      const field = path.at(-1);
      if (value === undefined) {
        delete parent[field];
      } else {
        parent[field] = value;
      }

      assert.throws(() => validateExternalWeatherResponse(response), {
        name: "TypeError",
        message: `Invalid weather response: ${path.join(".")} must be a finite number.`,
      });
    }
  });
}

test("runtime validation rejects missing current data and a missing or non-string time", () => {
  const response = makeWeatherResponse();
  delete response.current;
  assert.throws(() => validateExternalWeatherResponse(response), {
    name: "TypeError",
    message: "Invalid weather response: current must be an object.",
  });

  for (const time of [undefined, null, 123, true, {}, []]) {
    const invalid = makeWeatherResponse();
    if (time === undefined) {
      delete invalid.current.time;
    } else {
      invalid.current.time = time;
    }
    assert.throws(() => validateExternalWeatherResponse(invalid), {
      name: "TypeError",
      message: "Invalid weather response: current.time must be a string.",
    });
  }
});
