import { ChevronDown } from "lucide-react";
import { useState } from "react";
import styles from "./AccordionSection.module.css";

type AccordionSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <ChevronDown
          size={16}
          className={`${styles.icon} ${isOpen ? styles.iconOpen : ""}`}
        />
      </button>
      {isOpen ? <div className={styles.body}>{children}</div> : null}
    </section>
  );
}
