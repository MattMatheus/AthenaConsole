import { lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { DOCUMENTATION_ALIAS_PATH, DOCUMENTATION_CANONICAL_PATH } from "./routeModel";

const StartWorkPage = lazy(() => import("../pages/StartWorkPage").then((m) => ({ default: m.StartWorkPage })));
const AgentCatalogPage = lazy(() =>
  import("../pages/AgentCatalogPage").then((m) => ({ default: m.AgentCatalogPage })),
);
const AgentDetailPage = lazy(() => import("../pages/AgentDetailPage").then((m) => ({ default: m.AgentDetailPage })));
const TaskCreatePage = lazy(() => import("../pages/TaskCreatePage").then((m) => ({ default: m.TaskCreatePage })));
const TaskRunDetailPage = lazy(() =>
  import("../pages/TaskRunDetailPage").then((m) => ({ default: m.TaskRunDetailPage })),
);
const SchedulesPage = lazy(() => import("../pages/SchedulesPage").then((m) => ({ default: m.SchedulesPage })));
const MissionsPage = lazy(() => import("../pages/MissionsPage").then((m) => ({ default: m.MissionsPage })));
const RunHistoryPage = lazy(() => import("../pages/SessionsPage").then((m) => ({ default: m.RunHistoryPage })));
const WorkflowsPage = lazy(() => import("../pages/WorkflowsPage").then((m) => ({ default: m.WorkflowsPage })));
const WorkflowQueuePage = lazy(() =>
  import("../pages/WorkflowQueuePage").then((m) => ({ default: m.WorkflowQueuePage })),
);
const WorkflowRunDetailPage = lazy(() =>
  import("../pages/WorkflowRunDetailPage").then((m) => ({ default: m.WorkflowRunDetailPage })),
);
const RunTemplatesPage = lazy(() =>
  import("../pages/RunTemplatesPage").then((m) => ({ default: m.RunTemplatesPage })),
);
const FailedWorkPage = lazy(() => import("../pages/FailedWorkPage").then((m) => ({ default: m.FailedWorkPage })));
const ResourcesPage = lazy(() => import("../pages/ResourcesPage").then((m) => ({ default: m.ResourcesPage })));
const DurableMemoryPage = lazy(() =>
  import("../pages/DurableMemoryPage").then((m) => ({ default: m.DurableMemoryPage })),
);
const DocumentationPage = lazy(() =>
  import("../pages/DocumentationPage").then((m) => ({ default: m.DocumentationPage })),
);
const RbacPage = lazy(() => import("../pages/RbacPage").then((m) => ({ default: m.RbacPage })));
const AuditTrailPage = lazy(() => import("../pages/AuditTrailPage").then((m) => ({ default: m.AuditTrailPage })));
const SettingsPage = lazy(() => import("../pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "start",
        element: <StartWorkPage />,
      },
      {
        path: "agents",
        element: <AgentCatalogPage />,
      },
      {
        path: "agents/:agentId",
        element: <AgentDetailPage />,
      },
      {
        path: "tasks",
        element: <TaskCreatePage />,
      },
      {
        path: "tasks/runs/:runId",
        element: <TaskRunDetailPage />,
      },
      {
        path: "schedules",
        element: <SchedulesPage />,
      },
      {
        path: "missions",
        element: <MissionsPage />,
      },
      {
        path: "runs",
        element: <RunHistoryPage />,
      },
      {
        path: "sessions",
        element: <Navigate to="/runs" replace />,
      },
      {
        path: "workflows",
        element: <WorkflowsPage />,
      },
      {
        path: "workflow-queue",
        element: <WorkflowQueuePage />,
      },
      {
        path: "workflows/runs/:runId",
        element: <WorkflowRunDetailPage />,
      },
      {
        path: "run-templates",
        element: <RunTemplatesPage />,
      },
      {
        path: "failed-work",
        element: <FailedWorkPage />,
      },
      {
        path: "resources",
        element: <ResourcesPage />,
      },
      {
        path: "memory",
        element: <DurableMemoryPage />,
      },
      {
        path: "docs",
        element: <DocumentationPage />,
      },
      {
        path: DOCUMENTATION_ALIAS_PATH,
        element: <Navigate to={DOCUMENTATION_CANONICAL_PATH} replace />,
      },
      {
        path: "rbac",
        element: <RbacPage />,
      },
      {
        path: "audit-trail",
        element: <AuditTrailPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);
