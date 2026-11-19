import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliUrl = new URL("../dist/index.js", import.meta.url).href;

async function runCli({ simulateFailure = false, networkFailureCities = [] } = {}) {
  // Stub only the test subprocess's HTTP boundary; production uses native fetch.
  const script = `
    import assert from "node:assert/strict";
    const simulateFailure = ${JSON.stringify(simulateFailure)};
    const networkFailureCities = ${JSON.stringify(networkFailureCities)};
    const citiesByLatitude = {
      "30.0444": "Cairo", "31.2001": "Alexandria", "24.0889": "Aswan",
    };
    globalThis.fetch = async (endpoint, options) => {
      const url = new URL(endpoint);
      const city = citiesByLatitude[url.searchParams.get("latitude")];
      assert.ok(city, "Request must target a configured city");
      assert.equal(url.origin, "https://api.open-meteo.com");
      assert.equal(options.method, "GET");
      const shouldFail = simulateFailure && city === "Alexandria";
      assert.equal(url.pathname, shouldFail ? "/v1/invalid-forecast" : "/v1/forecast");
      if (networkFailureCities.includes(city)) {
        throw new TypeError("fetch failed");
      }
      if (shouldFail) {
        return new Response("Not Found", { status: 404, statusText: "Not Found" });
      }
      return Response.json({
        latitude: Number(url.searchParams.get("latitude")),
        longitude: Number(url.searchParams.get("longitude")),
        current: {
          time: "2026-11-19T12:00",
          temperature_2m: 23.5,
          relative_humidity_2m: 65,
          precipitation: 0,
          wind_speed_10m: 12,
        },
      });
    };
    process.argv = [process.execPath, ${JSON.stringify(cliUrl)}];
    if (simulateFailure) process.argv.push("--simulate-failure");
    await import(${JSON.stringify(cliUrl)});
  `;
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    { timeout: 10_000 },
  );
  assert.equal(stderr, "");
  return stdout;
}

function assertSummary(output, successful, failed) {
  assert.match(output, /Total requests: 3/);
  assert.ok(output.includes(`Successful requests: ${successful}`));
  assert.ok(output.includes(`Failed requests: ${failed}`));
}

function assertReport(output, city) {
  assert.ok(output.includes(`${city}\n  Temperature: 23.5`));
}

test("CLI defaults to valid endpoints and reports all successful cities", async () => {
  const output = await runCli();

  for (const city of ["Cairo", "Alexandria", "Aswan"]) {
    assertReport(output, city);
  }
  assert.doesNotMatch(output, /^Failed requests:/m);
  assertSummary(output, 3, 0);
});

test("CLI simulation logs Alexandria's HTTP error and keeps successful reports", async () => {
  const output = await runCli({ simulateFailure: true });

  assertReport(output, "Cairo");
  assertReport(output, "Aswan");
  assert.match(output, /Alexandria: Failed to fetch weather for Alexandria: HTTP 404/);
  assert.ok(!output.includes("Alexandria\n  Temperature:"));
  assertSummary(output, 2, 1);
});

test("CLI simulation tolerates an additional network failure", async () => {
  const output = await runCli({
    simulateFailure: true,
    networkFailureCities: ["Cairo"],
  });

  assertReport(output, "Aswan");
  assert.match(output, /Cairo: fetch failed/);
  assert.match(output, /Alexandria: Failed to fetch weather for Alexandria: HTTP 404/);
  assertSummary(output, 1, 2);
});

test("CLI prints city failures and a summary when every network request fails", async () => {
  const output = await runCli({
    networkFailureCities: ["Cairo", "Alexandria", "Aswan"],
  });

  assert.match(output, /No weather reports available/);
  for (const city of ["Cairo", "Alexandria", "Aswan"]) {
    assert.ok(output.includes(`${city}: fetch failed`));
  }
  assertSummary(output, 0, 3);
});
