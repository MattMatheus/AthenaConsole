import styles from "./PageScaffold.module.css";

export function ResourcesPage() {
  return (
    <section className={styles.page}>
      <h2>Resource Controls</h2>
      <p className={styles.lead}>
        Review operator-facing resource controls for directives and harness profiles as they become available.
      </p>
    </section>
  );
}
