import { Card } from "../../../components";
import type { FleetSummary } from "../types";
import styles from "./CostPersonaBreakdown.module.css";

type CostPersonaBreakdownProps = {
  summary: FleetSummary;
  onExportCsv: () => void;
  exportDisabled?: boolean;
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function CostPersonaBreakdown({ summary, onExportCsv, exportDisabled = false }: CostPersonaBreakdownProps) {
  const rows = summary.costSummary?.personaBreakdown ?? [];

  return (
    <Card className={styles.card ?? ""}>
      <div className={styles.headerRow ?? ""}>
        <h2 className={styles.title ?? ""}>Persona Cost Breakdown</h2>
        <button type="button" className={styles.exportButton ?? ""} onClick={onExportCsv} disabled={exportDisabled}>
          Export CSV
        </button>
      </div>
      <table className={styles.table ?? ""}>
        <thead>
          <tr>
            <th>Persona</th>
            <th>Spend (USD)</th>
            <th>Tokens</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className={styles.empty ?? ""}>
                No cost telemetry found for this month.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.personaName}>
                <td>{row.personaName}</td>
                <td>{usdFormatter.format(row.estimatedSpendUsd)}</td>
                <td>{row.totalTokens}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}
