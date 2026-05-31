import { Card } from "../../../components";
import type { OperationsSummary } from "../types";
import styles from "./CostAgentBreakdown.module.css";

type CostAgentBreakdownProps = {
  summary: OperationsSummary;
  onExportCsv: () => void;
  exportDisabled?: boolean;
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function CostAgentBreakdown({ summary, onExportCsv, exportDisabled = false }: CostAgentBreakdownProps) {
  const rows = summary.costSummary?.agentBreakdown ?? [];

  return (
    <Card className={styles.card ?? ""}>
      <div className={styles.headerRow ?? ""}>
        <h2 className={styles.title ?? ""}>Operator Usage Breakdown</h2>
        <button type="button" className={styles.exportButton ?? ""} onClick={onExportCsv} disabled={exportDisabled}>
          Export CSV
        </button>
      </div>
      <table className={styles.table ?? ""}>
        <thead>
          <tr>
            <th>Operator</th>
            <th>Usage Estimate</th>
            <th>Tokens</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className={styles.empty ?? ""}>
                No operator usage telemetry found for this month.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.agentName}>
                <td>{row.agentName}</td>
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
