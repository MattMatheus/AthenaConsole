import { Play, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  missionStatusTone,
  orderedMissionTasks,
  sortMissions,
  useMissionTasksQuery,
  useMissionsQuery,
  useRunMissionMutation,
  type MissionWorkbenchMission,
} from "../features/mission-workbench";
import type { TaskWorkbenchTask } from "../features/task-workbench";
import styles from "./MissionsPage.module.css";

const EMPTY_MISSIONS: MissionWorkbenchMission[] = [];
const EMPTY_TASKS: TaskWorkbenchTask[] = [];

function formatDate(value: string | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatJson(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusClass(status: MissionWorkbenchMission["status"] | TaskWorkbenchTask["status"]): string {
  const tone = missionStatusTone(status as MissionWorkbenchMission["status"]);
  if (tone === "success") {
    return styles.badgeSuccess ?? "";
  }
  if (tone === "warning") {
    return styles.badgeWarning ?? "";
  }
  if (tone === "danger") {
    return styles.badgeDanger ?? "";
  }
  return styles.badgeMuted ?? "";
}

function matchesSearch(mission: MissionWorkbenchMission, search: string): boolean {
  if (!search) {
    return true;
  }
  const lower = search.toLowerCase();
  return [mission.id, mission.title, mission.goal, mission.status].some((value) => value.toLowerCase().includes(lower));
}

export function MissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMissionId = searchParams.get("missionId")?.trim() ?? "";
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState(requestedMissionId);
  const missionsQuery = useMissionsQuery({ includeArchived });
  const runMissionMutation = useRunMissionMutation();
  const missions = missionsQuery.data?.missions ?? EMPTY_MISSIONS;
  const visibleMissions = useMemo(
    () => sortMissions(missions).filter((mission) => matchesSearch(mission, search.trim())),
    [missions, search],
  );
  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedMissionId) ?? visibleMissions[0],
    [missions, selectedMissionId, visibleMissions],
  );
  const missionTasksQuery = useMissionTasksQuery(selectedMission?.id);
  const tasks = missionTasksQuery.data?.tasks ?? EMPTY_TASKS;
  const orderedTasks = useMemo(() => orderedMissionTasks(selectedMission, tasks), [selectedMission, tasks]);
  const canRunMission = selectedMission?.status === "ready";

  useEffect(() => {
    if (requestedMissionId) {
      setSelectedMissionId(requestedMissionId);
    }
  }, [requestedMissionId]);

  useEffect(() => {
    if (selectedMission && selectedMission.id !== selectedMissionId) {
      setSelectedMissionId(selectedMission.id);
    }
  }, [selectedMission, selectedMissionId]);

  function selectMission(id: string): void {
    setSelectedMissionId(id);
    const next = new URLSearchParams(searchParams);
    next.set("missionId", id);
    setSearchParams(next, { replace: true });
  }

  async function refresh(): Promise<void> {
    await Promise.all([missionsQuery.refetch(), selectedMission ? missionTasksQuery.refetch() : Promise.resolve()]);
  }

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.panelMeta}>Mission Workbench</p>
          <h2 className={styles.pageTitle}>Missions</h2>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => void refresh()}
          disabled={missionsQuery.isFetching || missionTasksQuery.isFetching}
          aria-label="Refresh missions"
          title="Refresh missions"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Search</span>
          <span className={styles.inputWrap}>
            <Search size={15} />
            <input
              className={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="mission, status, goal"
              type="search"
            />
          </span>
        </label>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          <span>Include archived</span>
        </label>
      </div>

      {missionsQuery.isLoading ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Loading Missions</p>
          <p className={styles.description}>Reading local mission state.</p>
        </div>
      ) : null}

      {missionsQuery.error instanceof Error ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>Unable To Load Missions</p>
          <p className={styles.errorText}>{missionsQuery.error.message}</p>
        </div>
      ) : null}

      {!missionsQuery.isLoading && !missionsQuery.error && missions.length === 0 ? (
        <div className={styles.state}>
          <p className={styles.stateTitle}>No Missions Found</p>
          <p className={styles.description}>Instantiate a workflow template or create missions through the API to populate this workbench.</p>
        </div>
      ) : null}

      {!missionsQuery.isLoading && !missionsQuery.error && missions.length > 0 ? (
        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Mission Queue</p>
                <p className={styles.panelMeta}>{visibleMissions.length} shown</p>
              </div>
            </div>
            <div className={styles.missionList}>
              {visibleMissions.map((mission) => (
                <button
                  type="button"
                  key={mission.id}
                  className={`${styles.missionRow} ${selectedMission?.id === mission.id ? styles.missionRowActive : ""}`}
                  onClick={() => selectMission(mission.id)}
                >
                  <span className={styles.rowTop}>
                    <span>
                      <span className={styles.missionName}>{mission.title}</span>
                      <span className={styles.mono}>{mission.id}</span>
                    </span>
                    <span className={statusClass(mission.status)}>{mission.status}</span>
                  </span>
                  <span className={styles.description}>{mission.goal || "No goal recorded."}</span>
                  <span className={styles.badgeRow}>
                    <span className={styles.badge}>{mission.taskOrder.length} ordered tasks</span>
                    <span className={styles.badgeMuted}>updated {formatDate(mission.updatedAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>{selectedMission?.title ?? "Mission Detail"}</p>
                <p className={styles.panelMeta}>{selectedMission?.id ?? "No mission selected"}</p>
              </div>
              {selectedMission ? <span className={statusClass(selectedMission.status)}>{selectedMission.status}</span> : null}
            </div>
            <div className={styles.panelBody}>
              {selectedMission ? (
                <>
                  <section className={styles.section}>
                    <div className={styles.actionBar}>
                      <Link className={styles.inlineLink} to={`/tasks?missionId=${encodeURIComponent(selectedMission.id)}`}>
                        Open in task workbench
                      </Link>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => runMissionMutation.mutate(selectedMission.id)}
                        disabled={!canRunMission || runMissionMutation.isPending}
                      >
                        <Play size={16} /> Run Mission
                      </button>
                    </div>
                    <dl className={styles.kvList}>
                      <div>
                        <dt>Goal</dt>
                        <dd>{selectedMission.goal || "No goal recorded."}</dd>
                      </div>
                      <div>
                        <dt>Updated</dt>
                        <dd>{formatDate(selectedMission.updatedAt)}</dd>
                      </div>
                    </dl>
                    <details className={styles.details}>
                      <summary>Context Preview</summary>
                      <pre className={styles.codeBlock}>{formatJson(selectedMission.context)}</pre>
                    </details>
                    {!canRunMission ? <p className={styles.description}>Only ready missions can start a sequential run.</p> : null}
                    {runMissionMutation.error instanceof Error ? <p className={styles.errorText}>{runMissionMutation.error.message}</p> : null}
                  </section>

                  <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <div>
                        <p className={styles.sectionTitle}>Ordered Tasks</p>
                        <p className={styles.panelMeta}>{orderedTasks.length} loaded</p>
                      </div>
                    </div>
                    {missionTasksQuery.isLoading ? <p className={styles.description}>Loading mission tasks.</p> : null}
                    {missionTasksQuery.error instanceof Error ? <p className={styles.errorText}>{missionTasksQuery.error.message}</p> : null}
                    <div className={styles.taskList}>
                      {orderedTasks.map((task, index) => (
                        <article key={task.id} className={styles.taskItem}>
                          <div className={styles.rowTop}>
                            <div>
                              <p className={styles.missionName}>{index + 1}. {task.title}</p>
                              <p className={styles.mono}>{task.id}</p>
                            </div>
                            <span className={statusClass(task.status)}>{task.status}</span>
                          </div>
                          <p className={styles.description}>{task.description || "No description recorded."}</p>
                          <div className={styles.badgeRow}>
                            {task.capabilityRequirements.map((capability) => (
                              <span key={capability} className={styles.badge}>{capability}</span>
                            ))}
                            {task.dependsOn.length > 0 ? <span className={styles.badgeMuted}>depends on {task.dependsOn.join(", ")}</span> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <div className={styles.stateInline}>
                  <p className={styles.stateTitle}>No Mission Selected</p>
                  <p className={styles.description}>Select a mission from the queue.</p>
                </div>
              )}
            </div>
          </section>

          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelTitle}>Last Run</p>
                <p className={styles.panelMeta}>{runMissionMutation.data?.run.status ?? "None"}</p>
              </div>
            </div>
            <div className={styles.panelBody}>
              {runMissionMutation.data ? (
                <section className={styles.section}>
                  <p className={styles.missionName}>{runMissionMutation.data.run.id}</p>
                  <p className={styles.mono}>{runMissionMutation.data.run.backend ?? "sequential-mission"}</p>
                  <div className={styles.taskList}>
                    {runMissionMutation.data.childRuns.map((run) => (
                      <div key={run.id} className={styles.taskItem}>
                        <Link className={styles.inlineLink} to={`/tasks/runs/${encodeURIComponent(run.id)}`}>
                          {run.id}
                        </Link>
                        <p className={styles.mono}>{run.targetId}</p>
                        <span className={styles.badgeMuted}>{run.status}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <p className={styles.description}>No mission run started in this session.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
