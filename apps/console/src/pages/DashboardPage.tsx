import { Link } from "react-router-dom";
import { FleetDashboard } from "../features/fleet";
import styles from "./PageScaffold.module.css";

export function DashboardPage() {
  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <p className={styles.lead}>
          Fleet health, orchestration state, and policy posture from a single control
          plane view.
        </p>
        <Link to="/mission-control" className={styles.primaryCta}>
          New Task
        </Link>
      </div>
      <FleetDashboard />
    </section>
  );
}
