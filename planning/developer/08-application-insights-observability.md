<!-- AUDIENCE: Internal/Technical -->

# Azure Application Insights Observability

This document is retained as Azure observability implementation context. Cloud observability is deferred during the 2026 product-direction reset.

## Runtime Configuration

Set these environment variables on control-plane deployment:

- `ATHENA_APPINSIGHTS_ENABLED=true`
- `ATHENA_APPINSIGHTS_CONNECTION_STRING=<connection-string>`
- `ATHENA_APPINSIGHTS_SAMPLING_PERCENTAGE=20`
- `ATHENA_APPINSIGHTS_CLOUD_ROLE_NAME=athena-control-plane`
- `ATHENA_APPINSIGHTS_TRACK_DEPENDENCIES=true`

When disabled, runtime behavior is unchanged.

## Telemetry Signals

- `athena.api.request`
  - Request-level custom event.
  - Dimensions include `runId`, `personaId`, `tenantId` when available.
- `athena.ai.model.response`
  - AI model completion latency event (`latencyMs`).
- `athena.redis.lock.acquire`
  - Redis lock acquisition timing (`latencyMs`) with `acquired=true|false`.

## Correlation

- API server supports W3C trace headers:
  - `traceparent`
  - `tracestate`
- CORS allow-list includes trace headers and tenant-id header.

## Infra Outputs

Terraform dev environment emits:

- `application_insights_connection_string` (sensitive)
- `application_insights_workbook_id`
- `application_insights_dashboard_id`

Use the connection string output to populate repository secret:

- `ATHENA_APPINSIGHTS_CONNECTION_STRING_DEV`
