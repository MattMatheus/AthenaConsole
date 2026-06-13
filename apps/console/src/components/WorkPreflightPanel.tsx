import styles from "./WorkPreflightPanel.module.css";
import type { WorkPreflightItem, WorkPreflightStatus } from "./workPreflightModel";

export type { WorkPreflightItem, WorkPreflightStatus } from "./workPreflightModel";

export function WorkPreflightPanel({
  badge,
  items,
  title,
}: {
  badge: string;
  items: WorkPreflightItem[];
  title: string;
}) {
  return (
    <section className={styles.preflightPanel} aria-label="Work preflight">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.panelMeta}>Preflight</p>
          <p className={styles.panelTitle}>{title}</p>
        </div>
        <span className={styles.badge}>{badge}</span>
      </div>
      <div className={styles.preflightGrid}>
        {items.map((item) => (
          <article className={styles.preflightItem} key={item.kind}>
            <div className={styles.preflightTop}>
              <span className={styles.panelMeta}>{item.label}</span>
              <span className={statusClassName(item.status)}>{statusLabel(item.status)}</span>
            </div>
            <p className={styles.preflightValue}>{item.value}</p>
            {item.detail ? <p className={styles.description}>{item.detail}</p> : null}
            {item.fixPath ? <p className={styles.fixPath}>{item.fixPath}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function statusClassName(status: WorkPreflightStatus): string {
  if (status === "ready") {
    return styles.badgeSuccess ?? "";
  }
  if (status === "blocked") {
    return styles.badgeBlocked ?? "";
  }
  return styles.badgeWarning ?? "";
}

function statusLabel(status: WorkPreflightStatus): string {
  if (status === "ready") {
    return "ready";
  }
  if (status === "blocked") {
    return "blocked";
  }
  return "check";
}
