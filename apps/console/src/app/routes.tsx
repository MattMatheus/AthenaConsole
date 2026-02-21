import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../layout/AppLayout";
import { DashboardPage } from "../pages/DashboardPage";
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
