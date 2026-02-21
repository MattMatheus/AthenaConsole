import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import styles from "./styles/AuthGate.module.css";

const SESSION_KEY = "athena.console.authenticated";

function readConfiguredPassword(): string | undefined {
  const value = import.meta.env.VITE_CONSOLE_PASSWORD?.trim();
  return value ? value : undefined;
}

function readSessionAuth(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.sessionStorage.getItem(SESSION_KEY) === "true";
}

function App() {
  const configuredPassword = useMemo(() => readConfiguredPassword(), []);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setAuthenticated] = useState<boolean>(() =>
    configuredPassword ? readSessionAuth() : true,
  );

  const requiresLogin = Boolean(configuredPassword);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configuredPassword) {
      return;
    }

    if (input === configuredPassword) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(SESSION_KEY, "true");
      }
      setAuthenticated(true);
      setError(null);
      setInput("");
      return;
    }

    setError("Incorrect password.");
  };

  if (requiresLogin && !isAuthenticated) {
    return (
      <div className={styles.shell}>
        <section className={styles.card}>
          <p className={styles.eyebrow}>ProjectAthena</p>
          <h1 className={styles.title}>Console Access</h1>
          <p className={styles.subtitle}>Enter the access password configured for this environment.</p>
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.label} htmlFor="console-password">
              Password
            </label>
            <input
              id="console-password"
              className={styles.input}
              type="password"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              autoComplete="current-password"
              required
            />
            {error ? <p className={styles.error}>{error}</p> : null}
            <button className={styles.button} type="submit">
              Unlock Console
            </button>
          </form>
        </section>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default App;
