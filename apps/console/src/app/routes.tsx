import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import { AgentCatalogPage } from "../pages/AgentCatalogPage";
import { AgentDetailPage } from "../pages/AgentDetailPage";
import { DashboardPage } from "../pages/DashboardPage";
import { MissionControlPage } from "../pages/MissionControlPage";
import { DlqPage } from "../pages/DlqPage";
import { AuditTrailPage } from "../pages/AuditTrailPage";
import { RbacPage } from "../pages/RbacPage";
import { ResourcesPage } from "../pages/ResourcesPage";
import { SessionsPage } from "../pages/SessionsPage";
import { SettingsPage } from "../pages/SettingsPage";
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
