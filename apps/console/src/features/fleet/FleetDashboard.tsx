import { Card } from "../../components";
import { fetchMonthlyCostReportCsv } from "./api";
import { CostPersonaBreakdown } from "./components/CostPersonaBreakdown";
import { CostTrendChart } from "./components/CostTrendChart";
import { MetricsGrid } from "./components/MetricsGrid";
import { RecentEventsTable } from "./components/RecentEventsTable";
import { useFleetSummaryQuery, useRecentEventsQuery } from "./queries";
import styles from "./FleetDashboard.module.css";

export function FleetDashboard() {
  const summaryQuery = useFleetSummaryQuery();
  const eventsQuery = useRecentEventsQuery();

  async function handleExportCsv(): Promise<void> {
    const month = summaryQuery.data?.costSummary?.month;
    const csv = await fetchMonthlyCostReportCsv(month);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `operator-usage-report-${month ?? "current"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (summaryQuery.isLoading || eventsQuery.isLoading) {
    return (
      <Card className={styles.stateCard ?? ""}>
        <p className={styles.stateTitle ?? ""}>Loading Dashboard</p>
        <p>Checking active work, resource usage, and recent operator activity...</p>
      </Card>
    );
  }

  if (summaryQuery.error || eventsQuery.error || !summaryQuery.data || !eventsQuery.data) {
    return (
      <Card className={styles.stateCard ?? ""}>
        <p className={styles.stateTitle ?? ""}>Unable to load dashboard</p>
        <p>Refresh the dashboard or check the local API before assigning new work.</p>
        <p className={styles.error ?? ""}>
          {summaryQuery.error instanceof Error
            ? summaryQuery.error.message
            : eventsQuery.error instanceof Error
              ? eventsQuery.error.message
              : "Unexpected response from backend services"}
        </p>
      </Card>
    );
  }

  return (
    <section className={styles.dashboard ?? ""}>
      <MetricsGrid summary={summaryQuery.data} />
      <div className={styles.columns ?? ""}>
        <CostPersonaBreakdown summary={summaryQuery.data} onExportCsv={() => void handleExportCsv()} />
        <CostTrendChart costSummary={summaryQuery.data.costSummary} />
      </div>
      <RecentEventsTable events={eventsQuery.data} />
    </section>
  );
}
