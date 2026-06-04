import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import { AgentCatalogPage } from "../pages/AgentCatalogPage";
import { AgentDetailPage } from "../pages/AgentDetailPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DocumentationPage } from "../pages/DocumentationPage";
import { DurableMemoryPage } from "../pages/DurableMemoryPage";
import { MissionsPage } from "../pages/MissionsPage";
import { FailedWorkPage } from "../pages/FailedWorkPage";
import { AuditTrailPage } from "../pages/AuditTrailPage";
import { RbacPage } from "../pages/RbacPage";
import { ResourcesPage } from "../pages/ResourcesPage";
import { RunTemplatesPage } from "../pages/RunTemplatesPage";
import { SchedulesPage } from "../pages/SchedulesPage";
import { RunHistoryPage } from "../pages/SessionsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { StartWorkPage } from "../pages/StartWorkPage";
import { TaskCreatePage } from "../pages/TaskCreatePage";
import { TaskRunDetailPage } from "../pages/TaskRunDetailPage";
import { WorkflowRunDetailPage } from "../pages/WorkflowRunDetailPage";
import { WorkflowsPage } from "../pages/WorkflowsPage";
import { DOCUMENTATION_ALIAS_PATH, DOCUMENTATION_CANONICAL_PATH } from "./routeModel";

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
