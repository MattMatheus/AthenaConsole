import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import { AgentCatalogPage } from "../pages/AgentCatalogPage";
import { AgentDetailPage } from "../pages/AgentDetailPage";
import { DashboardPage } from "../pages/DashboardPage";
import { MissionControlPage } from "../pages/MissionControlPage";
import { MissionsPage } from "../pages/MissionsPage";
import { DlqPage } from "../pages/DlqPage";
import { AuditTrailPage } from "../pages/AuditTrailPage";
import { RbacPage } from "../pages/RbacPage";
import { ResourcesPage } from "../pages/ResourcesPage";
import { RunTemplatesPage } from "../pages/RunTemplatesPage";
import { SchedulesPage } from "../pages/SchedulesPage";
import { SessionsPage } from "../pages/SessionsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { TaskCreatePage } from "../pages/TaskCreatePage";
import { TaskRunDetailPage } from "../pages/TaskRunDetailPage";
import { WorkflowRunDetailPage } from "../pages/WorkflowRunDetailPage";
import { WorkflowsPage } from "../pages/WorkflowsPage";

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
        path: "mission-control",
        element: <MissionControlPage />,
      },
      {
        path: "sessions",
        element: <SessionsPage />,
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
        path: "dlq",
        element: <DlqPage />,
      },
      {
        path: "resources",
        element: <ResourcesPage />,
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
