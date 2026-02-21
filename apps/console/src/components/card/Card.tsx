import type { ReactNode } from "react";
import styles from "./Card.module.css";

type CardProps = {
  children: ReactNode;
  className?: string | undefined;
  padded?: boolean;
};

export function Card({ children, className = "", padded = true }: CardProps) {
  const classNames = [styles.card, padded ? styles.padded : "", className]
    .filter(Boolean)
    .join(" ");

  return <section className={classNames}>{children}</section>;
}
