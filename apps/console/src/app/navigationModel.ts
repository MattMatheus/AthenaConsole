import {
  AlertTriangle,
  Activity,
  BookOpen,
  Bot,
  Building2,
  CalendarClock,
  Database,
  History,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquareStack,
  Target,
  Workflow,
} from "lucide-react";

export type NavItem = {
  path: string;
  label: string;
  match: RegExp;
  icon: LucideIcon;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    label: "Operate",
    items: [
      { path: "/", label: "Dashboard", match: /^\/$/, icon: LayoutDashboard },
      { path: "/start", label: "Start Work", match: /^\/start/, icon: Sparkles },
      { path: "/workflow-queue", label: "Queue", match: /^\/workflow-queue/, icon: Activity },
      { path: "/runs", label: "Work History", match: /^\/runs|^\/sessions/, icon: History },
      { path: "/agents", label: "Capabilities", match: /^\/agents/, icon: Bot },
      { path: "/resources", label: "Resources", match: /^\/resources/, icon: SlidersHorizontal },
      { path: "/memory", label: "Review", match: /^\/memory/, icon: Database },
    ],
  },
  {
    label: "Advanced work",
    items: [
      { path: "/tasks", label: "Tasks", match: /^\/tasks/, icon: ListChecks },
      { path: "/workflows", label: "Workflow Templates", match: /^\/workflows/, icon: Workflow },
      { path: "/missions", label: "Missions", match: /^\/missions/, icon: Target },
      { path: "/schedules", label: "Schedules", match: /^\/schedules/, icon: CalendarClock },
      { path: "/run-templates", label: "Run Templates", match: /^\/run-templates/, icon: SquareStack },
    ],
  },
  {
    label: "Admin",
    items: [
      { path: "/audit-trail", label: "Audit Trail", match: /^\/audit-trail/, icon: ScrollText },
      { path: "/rbac", label: "Access Control", match: /^\/rbac/, icon: ShieldCheck },
      { path: "/workspaces", label: "Workspaces", match: /^\/workspaces/, icon: Building2 },
      { path: "/failed-work", label: "Failed Work", match: /^\/failed-work/, icon: AlertTriangle },
      { path: "/settings", label: "Settings", match: /^\/settings/, icon: Settings },
      { path: "/docs", label: "Documentation", match: /^\/docs/, icon: BookOpen },
    ],
  },
];

export const navItems = navSections.flatMap((section) => section.items);
