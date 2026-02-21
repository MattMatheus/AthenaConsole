import { Card } from "../../../components";
import type { FleetSummary } from "../types";
import styles from "./CostTrendChart.module.css";

type CostTrendChartProps = {
  costSummary: FleetSummary["costSummary"];
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function CostTrendChart({ costSummary }: CostTrendChartProps) {
  const inputRatio = Math.max(0, Math.min(1, costSummary?.tokenMix.inputRatio ?? 0));
  const outputRatio = Math.max(0, Math.min(1, costSummary?.tokenMix.outputRatio ?? 0));
  const inputPercent = Math.round(inputRatio * 100);
  const outputPercent = Math.round(outputRatio * 100);
  const offset = 100 - inputPercent;
  const hasAzureBillingSource = (costSummary?.providerBreakdown ?? []).some((row) => row.provider === "azure-billing");

  return (
    <Card className={styles.card ?? ""}>
      <h2 className={styles.title ?? ""}>Input vs Output Token Mix</h2>
      <div className={styles.layout ?? ""}>
        <svg className={styles.donut ?? ""} viewBox="0 0 42 42" role="img" aria-label="Input and output token ratio">
          <circle className={styles.track ?? ""} cx="21" cy="21" r="15.9155" />
          <circle
            className={styles.inputArc ?? ""}
            cx="21"
            cy="21"
            r="15.9155"
            strokeDasharray={`${inputPercent} ${100 - inputPercent}`}
            strokeDashoffset="25"
          />
          <circle
            className={styles.outputArc ?? ""}
            cx="21"
            cy="21"
            r="15.9155"
            strokeDasharray={`${outputPercent} ${100 - outputPercent}`}
            strokeDashoffset={String(25 - offset)}
          />
          <text x="21" y="20" className={styles.donutValue ?? ""} textAnchor="middle">
            {inputPercent}%
          </text>
          <text x="21" y="25" className={styles.donutLabel ?? ""} textAnchor="middle">
            input
          </text>
        </svg>

        <div className={styles.legend ?? ""}>
          <div className={styles.row ?? ""}>
            <span className={`${styles.swatch ?? ""} ${styles.inputSwatch ?? ""}`} />
            <span>Input tokens: {costSummary?.tokenMix.inputTokens ?? 0}</span>
          </div>
          <div className={styles.row ?? ""}>
            <span className={`${styles.swatch ?? ""} ${styles.outputSwatch ?? ""}`} />
            <span>Output tokens: {costSummary?.tokenMix.outputTokens ?? 0}</span>
          </div>
          <p className={styles.monthTotal ?? ""}>
            Month total: {usdFormatter.format(costSummary?.totalEstimatedSpendUsd ?? 0)}
          </p>
          {hasAzureBillingSource ? <p className={styles.monthTotal ?? ""}>Data source: Azure Billing API</p> : null}
        </div>
      </div>
    </Card>
  );
}
