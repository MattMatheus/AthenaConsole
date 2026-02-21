import { Card } from "../../../components";
import type { FleetEvent } from "../types";
import styles from "./RecentEventsTable.module.css";

type RecentEventsTableProps = {
  events: FleetEvent[];
};

function statusClass(status: FleetEvent["status"]): string {
  if (status === "error") {
    return styles.error ?? "";
  }
  if (status === "warning") {
    return styles.warning ?? "";
  }
  return styles.success ?? "";
}

export function RecentEventsTable({ events }: RecentEventsTableProps) {
  return (
    <Card className={styles.card ?? ""} padded={false}>
      <h2 className={styles.header ?? ""}>Recent Events</h2>
      <table className={styles.table ?? ""}>
        <thead>
          <tr>
            <th>Status</th>
            <th>Event</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                <span
                  className={`${styles.status ?? ""} ${statusClass(event.status)}`}
                  aria-label={event.status}
                  title={event.status}
                />
              </td>
              <td>{event.message}</td>
              <td className={styles.timestamp ?? ""}>{event.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
