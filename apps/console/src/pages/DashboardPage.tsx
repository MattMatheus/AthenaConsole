import { FleetDashboard } from "../features/fleet";
import styles from "./PageScaffold.module.css";

export function DashboardPage() {
  return (
    <section className={styles.page}>
      <p className={styles.lead}>
        Fleet health, orchestration state, and policy posture from a single control
        plane view.
      </p>
      <FleetDashboard />
    </section>
  );
}
