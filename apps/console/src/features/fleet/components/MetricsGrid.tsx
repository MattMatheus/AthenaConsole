import { Card } from "../../../components";
import type { FleetSummary } from "../types";
import styles from "./MetricsGrid.module.css";

type MetricsGridProps = {
  summary: FleetSummary;
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function MetricsGrid({ summary }: MetricsGridProps) {
  const metrics = [
    { label: "Active Work", value: String(summary.running) },
    {
      label: "Active Sessions",
      value: String(summary.operationalSummary?.totalActiveSessions ?? 0),
    },
    {
      label: "System CPU (avg)",
      value: `${percentFormatter.format(summary.operationalSummary?.aggregateResourceUsage.cpuUsage ?? 0)}%`,
    },
    {
      label: "System Memory (avg)",
      value: `${percentFormatter.format(summary.operationalSummary?.aggregateResourceUsage.memoryUsage ?? 0)}%`,
    },
    {
      label: "Monthly Usage Estimate",
      value: usdFormatter.format(summary.costSummary?.totalEstimatedSpendUsd ?? 0),
    },
  ];

  return (
    <div className={styles.grid}>
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <p className={styles.metricTitle}>{metric.label}</p>
          <p className={styles.metricValue}>{metric.value}</p>
        </Card>
      ))}
    </div>
  );
}
