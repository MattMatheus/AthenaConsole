import styles from "./SystemStatusCard.module.css";

type SystemStatusCardProps = {
  label: string;
  title: string;
  description: string;
};

export function SystemStatusCard({
  label,
  title,
  description,
}: SystemStatusCardProps) {
  return (
    <section className={styles.card}>
      <p className={styles.badge}>{label}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{description}</p>
    </section>
  );
}
