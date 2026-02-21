import type { URL } from "node:url";
import { AthenaError } from "../../runtime/errors.js";
import { parseJsonObject, requireString } from "../validation.js";

export function parseFleetCostReportQuery(requestUrl: URL): { month?: string } {
  const monthRaw = requestUrl.searchParams.get("month");
  if (!monthRaw) {
    return {};
  }
  const month = monthRaw.trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new AthenaError("CONFIG_ERROR", "fleet.cost.report.month must match YYYY-MM when provided.");
  }
  return { month };
}

export function parseProviderCostSettingsPutRequest(body: unknown): {
  providers: Array<{
    provider: string;
    inputCostPer1kTokensUsd: number;
    outputCostPer1kTokensUsd: number;
  }>;
} {
  const row = parseJsonObject(body, "fleet.cost.settings.put");
  if (!Array.isArray(row.providers)) {
    throw new AthenaError("CONFIG_ERROR", "fleet.cost.settings.put.providers must be an array.");
  }
  const providers = row.providers.map((entry, index) => {
    const providerRow = parseJsonObject(entry, `fleet.cost.settings.put.providers[${index}]`);
    const provider = requireString(providerRow, "provider", `fleet.cost.settings.put.providers[${index}]`).trim();
    if (!provider) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `fleet.cost.settings.put.providers[${index}].provider must be a non-empty string.`
      );
    }
    const inputCostPer1kTokensUsd = providerRow.inputCostPer1kTokensUsd;
    const outputCostPer1kTokensUsd = providerRow.outputCostPer1kTokensUsd;
    if (typeof inputCostPer1kTokensUsd !== "number" || !Number.isFinite(inputCostPer1kTokensUsd)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `fleet.cost.settings.put.providers[${index}].inputCostPer1kTokensUsd must be a finite number.`
      );
    }
    if (typeof outputCostPer1kTokensUsd !== "number" || !Number.isFinite(outputCostPer1kTokensUsd)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `fleet.cost.settings.put.providers[${index}].outputCostPer1kTokensUsd must be a finite number.`
      );
    }
    if (inputCostPer1kTokensUsd < 0 || outputCostPer1kTokensUsd < 0) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `fleet.cost.settings.put.providers[${index}] costs must be >= 0.`
      );
    }
    return {
      provider,
      inputCostPer1kTokensUsd,
      outputCostPer1kTokensUsd
    };
  });

  return { providers };
}
