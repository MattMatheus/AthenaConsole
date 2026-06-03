import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./GuidanceNote.module.css";

type GuidanceNoteProps = {
  title: string;
  children: ReactNode;
};

export function GuidanceNote({ title, children }: GuidanceNoteProps) {
  return (
    <details className={styles.note}>
      <summary className={styles.summary}>
        <ChevronRight size={15} aria-hidden className={styles.chevron} />
        <span>{title}</span>
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
