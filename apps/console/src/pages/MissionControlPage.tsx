import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components";
import styles from "./MissionControlPage.module.css";

async function fetchSpecialists(): Promise<string[]> {
  const response = await fetch("/api/v1/specialists");
  if (!response.ok) {
    throw new Error("Failed to fetch specialists");
  }
  const payload = (await response.json()) as { data?: { items?: unknown } };
  const items = payload.data?.items;
  if (!Array.isArray(items) || items.some((item) => typeof item !== "string")) {
    throw new Error("Invalid specialists response shape");
  }
  return items;
}

async function runSpecialist(request: {
  name: string;
  repoPath: string;
  headRef: string;
  baseRef?: string;
}) {
  const response = await fetch("/api/v1/specialists/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to run specialist");
  }
  return response.json();
}

async function runDirective(request: {
  input: string;
  sessionId?: string;
}) {
  const response = await fetch("/api/v1/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      sessionId: request.sessionId || `web-${Date.now()}`,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to run directive");
  }
  return response.json();
}

export function MissionControlPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"specialist" | "directive">("specialist");
  
  // Specialist Form State
  const [selectedSpecialist, setSelectedSpecialist] = useState("");
  const [repoPath, setRepoPath] = useState("/workspace/target-repo");
  const [headRef, setHeadRef] = useState("main");
  const [baseRef, setBaseRef] = useState("");

  // Directive Form State
  const [directiveInput, setDirectiveInput] = useState("");

  const specialistsQuery = useQuery({
    queryKey: ["specialists"],
    queryFn: fetchSpecialists,
    staleTime: 10_000,
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });

  const runSpecialistMutation = useMutation({
    mutationFn: runSpecialist,
    onSuccess: (data) => {
      navigate(`/sessions?sessionId=${data.result.sessionId}`);
    },
  });

  const runDirectiveMutation = useMutation({
    mutationFn: runDirective,
    onSuccess: (data) => {
      navigate(`/sessions?sessionId=${data.sessionId}`);
    },
  });

  const handleSpecialistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpecialist) return;
    runSpecialistMutation.mutate({
      name: selectedSpecialist,
      repoPath,
      headRef,
      ...(baseRef ? { baseRef } : {}),
    });
  };

  const handleDirectiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directiveInput) return;
    runDirectiveMutation.mutate({
      input: directiveInput,
    });
  };

  return (
    <section className={styles.page}>
      <p className={styles.lead}>
        Orchestrate tasks by selecting a specialist or submitting a direct directive to the fleet.
      </p>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${mode === "specialist" ? styles.tabActive : ""}`}
          onClick={() => setMode("specialist")}
        >
          Specialist Task
        </button>
        <button
          className={`${styles.tab} ${mode === "directive" ? styles.tabActive : ""}`}
          onClick={() => setMode("directive")}
        >
          Direct Directive
        </button>
      </div>

      <Card className={styles.formCard}>
        {mode === "specialist" ? (
          <form onSubmit={handleSpecialistSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="specialist">Specialist</label>
              <select
                id="specialist"
                value={selectedSpecialist}
                onChange={(e) => setSelectedSpecialist(e.target.value)}
                required
                disabled={specialistsQuery.isLoading || specialistsQuery.isError}
              >
                <option value="" disabled>
                  {specialistsQuery.isLoading
                    ? "Loading specialists..."
                    : specialistsQuery.isError
                      ? "Specialists unavailable"
                      : "Select a specialist..."}
                </option>
                {specialistsQuery.data?.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {specialistsQuery.isError && (
              <p className={styles.error}>
                {(specialistsQuery.error as Error).message}{" "}
                <button type="button" onClick={() => specialistsQuery.refetch()}>
                  Retry
                </button>
              </p>
            )}

            <div className={styles.field}>
              <label htmlFor="repo">Repository Path</label>
              <input
                id="repo"
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="/workspace/target-repo"
                required
              />
            </div>

            <div className={styles.grid}>
              <div className={styles.field}>
                <label htmlFor="head">Head Ref</label>
                <input
                  id="head"
                  type="text"
                  value={headRef}
                  onChange={(e) => setHeadRef(e.target.value)}
                  placeholder="main"
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="base">Base Ref (Optional)</label>
                <input
                  id="base"
                  type="text"
                  value={baseRef}
                  onChange={(e) => setBaseRef(e.target.value)}
                  placeholder="main"
                />
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={runSpecialistMutation.isPending}
            >
              {runSpecialistMutation.isPending ? "Launching Specialist..." : "Launch Specialist"}
            </button>

            {runSpecialistMutation.error && (
              <p className={styles.error}>{(runSpecialistMutation.error as Error).message}</p>
            )}
          </form>
        ) : (
          <form onSubmit={handleDirectiveSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="directive">Task Directive</label>
              <textarea
                id="directive"
                value={directiveInput}
                onChange={(e) => setDirectiveInput(e.target.value)}
                placeholder="Describe the task you want the fleet to perform..."
                rows={6}
                required
              />
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={runDirectiveMutation.isPending}
            >
              {runDirectiveMutation.isPending ? "Executing Directive..." : "Execute Directive"}
            </button>

            {runDirectiveMutation.error && (
              <p className={styles.error}>{(runDirectiveMutation.error as Error).message}</p>
            )}
          </form>
        )}
      </Card>
    </section>
  );
}
