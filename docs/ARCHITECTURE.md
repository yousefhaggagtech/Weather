# Weather data flow

The project uses small TypeScript modules in `src/`:

- `cities.ts` defines configured locations; `weather-url.ts` builds forecast URLs.
- `weather-models.ts` defines the external API contract and internal application model.
- `validate-weather-response.ts` validates unknown external data before it is trusted as an `ExternalWeatherResponse`.
- `map-weather-response.ts` converts a validated response and supplied city into a `ProcessedWeather` value. The separate models isolate application code from external field names and API changes.
- `classify-delivery-risk.ts` provides pure, educational risk classification: precipitation of at least 10 mm or wind of at least 40 km/h yields `HIGH_RISK`; other positive precipitation yields `CAUTION`; otherwise the result is `SAFE`.

Mapping and classification perform no network requests, logging, or I/O. Network orchestration is not implemented. The risk rules are not real delivery safety standards.

Run `npm test` to compile with strict TypeScript settings and execute the deterministic mapping and classification tests with Node's built-in test runner. Run `npm run typecheck` for compilation checks without emitting files.
