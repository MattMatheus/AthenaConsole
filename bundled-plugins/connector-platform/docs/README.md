# Connector Platform Fixture Pack

This bundled pack is a fixture for connector-platform primitives. It declares connector service metadata, credential binding requirements, scopes, rate limits, read and external-write operation classes, and mock fixture scenarios.

The pack is intentionally not a service integration. Its runner performs no live network calls, stores no secret values, and exists to validate connector manifests, readiness diagnostics, external-write approvals, and fixture harness behavior before service-specific connector packs are built.

