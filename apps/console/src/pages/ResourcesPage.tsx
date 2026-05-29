import styles from "./PageScaffold.module.css";

export function ResourcesPage() {
  return (
    <section className={styles.page}>
      <h2>Resource Controls</h2>
      <p className={styles.lead}>
        Review operator-facing controls for runtime profiles, directives, and shared execution resources as they become available.
      </p>
    </section>
  );
}
