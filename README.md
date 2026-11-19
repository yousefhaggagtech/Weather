# Delivery Weather Monitoring System

A small TypeScript command-line application that requests weather for **Cairo, Alexandria, and Aswan**, converts provider data into a consistent application model, and prints a monitoring report even when individual requests fail.

Built as an educational project for **Elevvo Backend Track — Module 3: Node.js Runtime and TypeScript Architecture**.

## 1. Project Overview

The application connects to the Open-Meteo forecast API using Node.js native `fetch`. For each configured city, it requests current temperature, relative humidity, precipitation, and wind speed. It checks the response, validates the JSON, and transforms it into a `ProcessedWeather` object with an educational delivery status.

It then prints successful city reports, any city-specific errors, and totals for successful and failed requests. Requests run concurrently, and one rejected request does not discard the others.

This project demonstrates Module 3 concepts through one connected example: TypeScript interfaces and strict checking, ES modules, asynchronous I/O, promises, runtime validation, pure mapping functions, and separation of responsibilities. It is a one-run CLI program; it does not continuously monitor weather or expose a web server.

## 2. The Real-World Business Case

Imagine a hypothetical delivery company with branches in Cairo, Alexandria, and Aswan. Its Operations Team wants a consistent report for each branch instead of interpreting a weather provider's raw JSON separately every time.

A standardized model gives each branch the same field names, expected units, and status vocabulary. It could help a team discuss weather conditions alongside other operational information. For example, a dashboard could consume `windSpeed` without knowing that the provider calls the field `wind_speed_10m`.

External failures complicate this workflow. Alexandria's request might receive an HTTP error while Cairo and Aswan return valid responses. Losing the whole batch would hide useful information; silently omitting Alexandria would hide the failure. This project preserves the successful reports and explicitly lists failed requests.

**This is an educational demonstration, not a real-world delivery safety decision tool.** The `SAFE`, `CAUTION`, and `HIGH_RISK` labels come from simplified programming rules, not validated safety standards. They do not account for road conditions, visibility, flooding, driver circumstances, or other factors needed for real operational decisions. In particular, `SAFE` is only a label in this exercise, not a safety guarantee.

## 3. The Problems We Are Solving

### Different data formats

The provider returns nested fields such as `current.temperature_2m`. Application code needs a smaller, consistent object with fields such as `temperature`, `city`, and `deliveryStatus`.

Passing provider JSON throughout the application would make reporting and future consumers depend on that provider's naming and nesting. A dedicated mapper converts the external format at the boundary.

### Independent request failures

Each city request can succeed or fail independently, even though all three use the same provider. A network error, an unsuccessful HTTP response, invalid JSON, or an unexpected response shape should become a failure for that city while other requests continue.

`Promise.allSettled` collects every outcome so the report can show partial success. It does not repair a failed request; it prevents that rejection from hiding the successful results.

## 4. What Is a Type-Safe Async Data Engine?

Here, “data engine” means a small pipeline that retrieves, checks, transforms, and collects data. It is a description of the design, not a separate framework or package.

The pieces work together as follows:

1. **TypeScript interfaces** describe the expected external response and the internal result. They help the compiler detect incorrect field access and incompatible values in application code.
2. **Native `fetch`** performs the HTTP GET request without a third-party HTTP client.
3. **`async`/`await`** expresses promise-based steps in a readable sequence: wait for the response, wait for JSON parsing, then validate and map it.
4. **Runtime validation** checks the actual external data before the application trusts its shape. The parsed value starts as `unknown`.
5. **Mapping functions** turn the validated provider model into the internal model, including derived values.
6. **`Promise.allSettled`** coordinates the independent city operations and preserves both successes and failures.

Type safety therefore has two parts: compile-time checks for code we write and runtime checks for data arriving from outside the application.

## 5. External vs Internal Data Models

These are the actual interfaces in [`src/weather-models.ts`](src/weather-models.ts):

```ts
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
```

`ExternalWeatherResponse` describes the subset of provider fields this project requires. An actual response may contain additional fields; the validator allows them. `ProcessedWeather` describes what the application needs after transformation.

### Before: illustrative external JSON

The following values are invented teaching data, **not live weather observations**:

```json
{
  "latitude": 31.2001,
  "longitude": 29.9187,
  "current": {
    "time": "2026-01-01T12:00",
    "temperature_2m": 23.5,
    "relative_humidity_2m": 65,
    "precipitation": 2.5,
    "wind_speed_10m": 12
  }
}
```

### After: illustrative internal JSON

Calling `mapWeatherResponse(data, "Alexandria")` produces:

```json
{
  "city": "Alexandria",
  "temperature": 23.5,
  "humidity": 65,
  "windSpeed": 12,
  "isRaining": true,
  "deliveryStatus": "CAUTION"
}
```

The transformation has these responsibilities:

| External input | Internal result | Reason |
| --- | --- | --- |
| Separate `city` argument | `city` | The configured city name is supplied by the caller, not inferred from coordinates. |
| `current.temperature_2m` | `temperature` | Flatten the nesting and use an application-facing name. |
| `current.relative_humidity_2m` | `humidity` | Rename the field consistently. |
| `current.wind_speed_10m` | `windSpeed` | Rename the field consistently. |
| `current.precipitation > 0` | `isRaining` | Derive a boolean using the exercise's simplified definition. |
| Precipitation and wind speed | `deliveryStatus` | Apply the classification rules below. |
| Latitude, longitude, and `current.time` | Omitted | The current internal model does not retain them. |

The CLI displays temperature in °C, humidity in %, and wind speed in km/h. Classification interprets precipitation in mm. The URL builder requests the four current-weather variables without explicit unit overrides, and the mapper copies numbers without converting units or checking unit metadata.

The classification rules, in evaluation order, are:

| Condition | Status |
| --- | --- |
| Precipitation ≥ 10 mm **or** wind speed ≥ 40 km/h | `HIGH_RISK` |
| Otherwise, precipitation > 0 mm | `CAUTION` |
| Otherwise | `SAFE` |

For example, zero precipitation with wind at 40 km/h still produces `HIGH_RISK`. Temperature and humidity do not affect this classification. These thresholds are educational constants in `classify-delivery-risk.ts`.

## 6. Understanding the Mapper

[`mapWeatherResponse`](src/map-weather-response.ts) accepts a validated `ExternalWeatherResponse` and a city name, then returns a new `ProcessedWeather` object.

It is a **pure function**: the same input values produce the same output values, it does not modify its inputs, and it performs no network calls, logging, file operations, or other side effects. Its classification helper is also pure. Returning a new object makes the transformation easy to reason about and test with fixed examples.

Separating models reduces coupling to the provider. Reporting code reads `weather.temperature`; it does not need to know about `current.temperature_2m`. If a provider changes its field names, the integration boundary—external model, validator, request builder, and mapper—may need updates, while consumers can keep using the internal contract.

The mapper does not validate untrusted JSON itself. Its typed input represents an already-validated value. Keeping validation, transformation, and I/O separate gives each module one clear responsibility.

## 7. Understanding Async/Await and the Node.js Runtime

**Asynchronous I/O** lets a program start an operation, such as an HTTP request, and continue other work while that operation is pending.

In this application, JavaScript executes on the main thread. Node.js and the operating system handle the underlying network work. Calling `fetch` returns a promise representing a future response. When an `async` function reaches `await` on a pending promise, that function pauses and gives control back to the runtime; it does not make the JavaScript thread sit in a blocking wait.

The **event loop** coordinates incoming events and ready callbacks. When a promise settles, its waiting continuation is scheduled through the promise microtask queue and can resume once the current JavaScript work allows it. The code after `await` still runs on the JavaScript thread.

In `monitorWeather`, `cities.map(...)` starts each city operation without awaiting the previous city first. All three HTTP requests can therefore be in flight together. This is concurrent I/O, not three JavaScript functions executing simultaneously on three CPU threads. The combined report is printed after every request has settled.

`async` does not automatically make CPU-heavy work non-blocking. A large synchronous loop would still occupy the JavaScript thread, and JSON parsing, validation, and mapping also require processing time. The benefit here is that time spent waiting for network responses does not block other JavaScript work.

## 8. Error Handling and Runtime Validation

The core sequence in [`fetch-weather.ts`](src/fetch-weather.ts) is:

```ts
const response = await fetch(endpoint, { method: "GET" });

if (!response.ok) {
  throw new Error(
    `Failed to fetch weather for ${city}: HTTP ${response.status} ${response.statusText}`,
  );
}

const data: unknown = await response.json();
validateExternalWeatherResponse(data);

return mapWeatherResponse(data, city);
```

### HTTP failures and thrown errors

`fetch` can reject for network failures. However, receiving an HTTP error response such as 404 or 503 normally still fulfills the fetch promise with a `Response` object. `response.ok` is true for status codes from 200 through 299, so the explicit check turns an unsuccessful HTTP response into a thrown error before its body is parsed as weather data.

Inside an `async` function, a thrown error rejects the returned promise. Network errors, JSON parsing errors, and validation errors also propagate as rejections. The monitor collects those rejections and associates each one with its city, using a fallback message if the rejection reason has no useful error message.

### Valid JSON is not necessarily valid weather data

`response.json()` parses JSON syntax. It does not prove that `current` exists, that temperature is a number, or that the payload matches our interface. For example, `{"current": null}` is valid JSON but invalid input for this mapper.

The validator accepts `unknown` and checks:

- The response and `current` are non-null objects, not arrays.
- Latitude, longitude, temperature, humidity, precipitation, and wind speed are finite numbers.
- `current.time` is a string.

Missing required fields and numeric strings such as `"23.5"` are rejected. The assertion signature `asserts response is ExternalWeatherResponse` lets TypeScript narrow the value after those checks succeed; it neither converts nor mutates the data.

**Compile-time checking** catches mistakes while compiling our TypeScript. Interfaces are erased from the emitted JavaScript, so they cannot inspect an HTTP response at runtime. Assigning a type or using a type assertion alone would not validate the incoming data.

The current validator checks structure and primitive types. It does not enforce geographic bounds, humidity ranges, non-negative precipitation or wind speed, timestamp validity, freshness, or unit metadata. These are limits of the current implementation, not guarantees implied by the interface.

### Reporting failures

A city failure is a normal batch outcome: the CLI prints it alongside successful reports and totals. If all requests fail, it prints `No weather reports available.` and the three failures. These handled city failures do not set a nonzero exit code. An unexpected top-level error instead prints `Weather monitoring could not complete: ...` to standard error and sets exit code 1.

## 9. Promise.all vs Promise.allSettled

Suppose Cairo and Aswan succeed while Alexandria fails:

| Behavior | `Promise.all` | `Promise.allSettled` |
| --- | --- | --- |
| Every request succeeds | Fulfills with all values. | Fulfills with all fulfilled outcome records. |
| Alexandria rejects | Rejects as soon as an input rejection is observed. | Waits for every input to fulfill or reject. |
| Access to partial results | The combined promise does not return a partial-results array. | Each outcome contains a value or rejection reason. |
| Appropriate use | Work that requires every result to succeed. | Independent work where partial success is useful. |

For this scenario, `allSettled` produces outcomes shaped like:

```ts
[
  { status: "fulfilled", value: cairoReport },
  { status: "rejected", reason: new Error("Alexandria request failed") },
  { status: "fulfilled", value: aswanReport },
]
```

This is an illustrative shape, not captured live output. The monitor separates it into `reports`, `failures`, and a `summary` with `totalRequests: 3`, `successfulRequests: 2`, and `failedRequests: 1`.

Both combinators preserve input order in their result arrays; they do not start the requests themselves. Here, the calls inside `cities.map` start the work. Neither combinator automatically cancels the other requests when one fails. With `Promise.all`, those other requests can continue even though the combined promise has already rejected.

`Promise.allSettled` fits this project's fault tolerance requirement because no city's report depends on another city's success. It preserves city association regardless of completion order. The monitor's async wrapper also turns synchronous loader throws into rejected promises.

This fault tolerance has limits: there is no explicit application timeout or retry policy. `allSettled` waits for the slowest pending request; it cannot by itself guarantee a completion deadline or availability of the shared provider.

## 10. Architecture and Data Flow

Each successful city request follows this pipeline:

```mermaid
flowchart LR
    API[Weather API] --> F[Fetch]
    F --> V[Runtime Validation]
    V --> M[Mapper]
    M --> P[ProcessedWeather]
    P --> R[Monitoring Report]
```

`fetch-weather.ts` owns the fetch, HTTP check, validation, and mapping sequence. The monitor coordinates three instances of that pipeline:

```text
index.ts + CITIES + buildWeatherUrl
                 |
                 v
monitorWeather starts three independent city promises
    |
    +-- Cairo:      fetch -> validate -> map -> fulfill or reject --+
    +-- Alexandria: fetch -> validate -> map -> fulfill or reject --+--> Promise.allSettled
    +-- Aswan:      fetch -> validate -> map -> fulfill or reject --+          |
                                                                            v
                                                               reports + failures + summary
                                                                            |
                                                                            v
                                                               index.ts prints monitoring report
```

`Promise.allSettled` observes the city promises together from the start and waits for all outcomes. A rejected request skips the remaining success steps for that city and becomes a failure entry.

The monitor accepts an injected `loadWeather` function rather than constructing URLs or printing output itself. This keeps coordination independent of HTTP integration and allows tests to supply controlled loaders. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the existing architecture note.

## 11. Project Structure

```text
Delivery Weather Monitoring System/
├── src/
│   ├── cities.ts
│   ├── weather-url.ts
│   ├── weather-models.ts
│   ├── validate-weather-response.ts
│   ├── classify-delivery-risk.ts
│   ├── map-weather-response.ts
│   ├── fetch-weather.ts
│   ├── monitor-weather.ts
│   └── index.ts
├── tests/
│   ├── fixtures/weather-response.mjs
│   ├── weather-mapping.test.mjs
│   ├── weather-validation.test.mjs
│   ├── weather-service.test.mjs
│   ├── weather-monitor.test.mjs
│   └── weather-cli.test.mjs
├── docs/ARCHITECTURE.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── README.md
├── LICENSE
└── .gitignore
```

| File or directory | Responsibility |
| --- | --- |
| `src/` | TypeScript application source. |
| `src/cities.ts` | Defines `CityConfig` and the names and coordinates of the three cities. |
| `src/weather-url.ts` | Builds Open-Meteo URLs with coordinates and requested current-weather variables using `URL` and `URLSearchParams`. |
| `src/weather-models.ts` | Defines the external and internal interfaces. |
| `src/validate-weather-response.ts` | Validates untrusted response data before mapping. |
| `src/classify-delivery-risk.ts` | Applies pure, simplified precipitation and wind classification rules. |
| `src/map-weather-response.ts` | Creates the internal model from validated provider data and a supplied city name. |
| `src/fetch-weather.ts` | Performs HTTP I/O, checks status, parses JSON, validates, and maps. |
| `src/monitor-weather.ts` | Defines monitoring result types, coordinates city promises, normalizes failure messages, and counts outcomes. |
| `src/index.ts` | CLI entry point: wires modules together, reads the simulation flag, prints results, and handles unexpected top-level errors. |
| `tests/fixtures/weather-response.mjs` | Creates reusable synthetic provider responses for tests. |
| `tests/weather-mapping.test.mjs` | Checks transformation, purity, preserved values, and classification boundaries. |
| `tests/weather-validation.test.mjs` | Checks valid data and rejection of missing, malformed, or non-finite values. |
| `tests/weather-service.test.mjs` | Checks asynchronous fetch success and HTTP, network, JSON, and validation failures. |
| `tests/weather-monitor.test.mjs` | Checks concurrent requests, partial success, empty batches, all failures, counts, and rejection handling. |
| `tests/weather-cli.test.mjs` | Runs isolated CLI subprocesses with mocked fetch to verify normal, simulated, and additional failure scenarios. |
| `docs/ARCHITECTURE.md` | Summarizes module boundaries, data flow, and testing strategy. |
| `package.json` | Declares ES module mode, the Node.js requirement, dependencies, and scripts. |
| `package-lock.json` | Records dependency versions for reproducible installation. |
| `tsconfig.json` | Configures strict TypeScript checks, ES2022 output, and NodeNext module handling. |
| `dist/` | Generated JavaScript from the build; ignored by Git. Tests and the CLI run this compiled code. |
| `node_modules/` | Installed dependencies; ignored by Git. |
| `.gitignore` | Excludes dependencies, build output, and environment files. |
| `LICENSE` | MIT license terms. |

## 12. Installation and Usage

### Prerequisites

- **Node.js 20 or newer**, as declared in `package.json`.
- **npm**, available with a standard Node.js installation.
- Internet access for dependency installation and live API execution. Tests use mocked HTTP responses and do not need the weather service.

Check your tools:

```sh
node --version
npm --version
```

Run the following commands from the project root. No API key, `.env` file, database, or separate server is required by this implementation.

### Install dependencies

```sh
npm ci
```

`npm ci` installs the dependencies recorded in the existing lockfile. `npm install` is an alternative when intentionally updating dependencies and the lockfile.

### Build

```sh
npm run build
```

This runs `tsc -p tsconfig.json` and emits JavaScript from `src/` into `dist/`. Node.js executes that JavaScript, not the source `.ts` files.

### Typecheck without emitting files

```sh
npm run typecheck
```

This runs `tsc -p tsconfig.json --noEmit`. Strict checks include null checking, implicit `any` checking, unused locals and parameters, and exact optional property types.

### Run normally

After building:

```sh
npm start
```

This runs `node dist/index.js`, requests all three cities, prints one report, and exits when the work is complete. Build again after changing TypeScript source; `npm start` does not compile automatically.

### Simulate an independent failure

After building:

```sh
npm start -- --simulate-failure
```

The `--` tells npm to forward the following argument to the application. Simulation replaces only Alexandria's endpoint path with `/v1/invalid-forecast`; Cairo and Aswan keep `/v1/forecast`.

This is a real HTTP request to an intentionally invalid path, not a locally mocked error. The exact status and message depend on the provider and network. The intended demonstration is two successes and one failure, but other requests may also fail when connectivity or the provider is unavailable.

### Run tests

```sh
npm test
```

The test script runs `npm run build && node --test`. Tests are JavaScript `.mjs` files using Node's built-in test runner and assertions against the compiled modules. Fetch mocks, synthetic fixtures, controlled promises, and isolated subprocesses keep verification deterministic and independent of live weather. One subprocess check uses `--unhandled-rejections=strict` to catch unhandled rejection bugs.

There is currently no lint script configured. The available quality commands are build, typecheck, and test.

## 13. Example Output

**Both examples below are illustrative, using invented values and an example error. They are not live weather observations or captured production reports.** The npm script banner is omitted. Actual values, successful cities, and error text depend on the external service.

### Illustrative normal run: all three requests succeed

```text
Weather Monitoring Report

Cairo
  Temperature: 23.5 °C
  Humidity: 65%
  Wind speed: 12 km/h
  Raining: No
  Delivery status: SAFE

Alexandria
  Temperature: 23.5 °C
  Humidity: 65%
  Wind speed: 12 km/h
  Raining: No
  Delivery status: SAFE

Aswan
  Temperature: 23.5 °C
  Humidity: 65%
  Wind speed: 12 km/h
  Raining: No
  Delivery status: SAFE

Summary
  Total requests: 3
  Successful requests: 3
  Failed requests: 0
```

### Illustrative failure simulation: Alexandria fails, Cairo and Aswan succeed

```text
Weather Monitoring Report

Cairo
  Temperature: 23.5 °C
  Humidity: 65%
  Wind speed: 12 km/h
  Raining: No
  Delivery status: SAFE

Aswan
  Temperature: 23.5 °C
  Humidity: 65%
  Wind speed: 12 km/h
  Raining: No
  Delivery status: SAFE

Failed requests:
  Alexandria: Failed to fetch weather for Alexandria: HTTP 404 Not Found

Summary
  Total requests: 3
  Successful requests: 2
  Failed requests: 1
```

Successful reports retain the configured city order, even if requests finish in a different order. Failed cities appear in the failure section rather than receiving fabricated weather values.

## 14. What I Learned

This project connects the Module 3 concepts in a practical workflow:

- **Node.js runtime:** run compiled JavaScript as an ES module CLI and understand how asynchronous network I/O cooperates with the event loop.
- **TypeScript architecture:** use strict compiler options, interfaces, explicit return types, and a union of allowed status strings to make contracts clear.
- **Trust boundaries:** treat external JSON as `unknown` and validate it at runtime instead of assuming an interface proves its contents.
- **Transformation:** use a pure mapper to isolate provider field names from application-facing data.
- **Async control flow:** use native fetch and `async`/`await` while distinguishing HTTP failures from rejected network operations.
- **Fault tolerance:** collect independent outcomes with `Promise.allSettled`, preserve city identity, and report partial success honestly.
- **Separation and testing:** keep classification, mapping, integration, coordination, and presentation in focused modules that can be tested without a live provider.

## 15. Future Improvements

These are possible next steps; they are **not implemented** in the current project:

- **Express API:** expose structured monitoring results through HTTP endpoints while reusing the internal model and monitor.
- **Caching:** reduce repeat provider calls with an explicit expiry and a clear indication when a report uses cached data.
- **Timeouts and retry policies:** add request deadlines, cancellation, bounded exponential backoff with jitter, and rules for which failures are retryable.
- **Scheduled monitoring:** run checks at defined intervals, handle overlapping runs, and decide how to report persistent failures.
- **Persistent storage:** retain reports and timestamps for historical analysis, with deliberate schema, retention, and migration choices.
- **Dashboards:** display successful reports, missing cities, freshness, and provider failures without presenting unavailable data as current.
- **Stronger domain validation:** check ranges, timestamps, and units, and retain observation time in the internal model so consumers can assess freshness.

Each addition should preserve the existing boundary between provider-specific data and the internal application model. A real operational system would also need independently established business and safety requirements beyond this exercise's simplified classifications.

