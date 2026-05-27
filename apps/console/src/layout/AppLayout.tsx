import { Menu, Search, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { usePersistentState } from "../hooks";
import styles from "./AppLayout.module.css";

type NavItem = {
  path: string;
  label: string;
  match: RegExp;
};

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", match: /^\/$/ },
  { path: "/agents", label: "Agents", match: /^\/agents/ },
  { path: "/tasks", label: "Tasks", match: /^\/tasks/ },
  { path: "/mission-control", label: "Mission Control", match: /^\/mission-control/ },
  { path: "/sessions", label: "Sessions", match: /^\/sessions/ },
  { path: "/workflows", label: "Workflows", match: /^\/workflows/ },
  { path: "/dlq", label: "DLQ Console", match: /^\/dlq/ },
  { path: "/resources", label: "Resources", match: /^\/resources/ },
  { path: "/rbac", label: "RBAC", match: /^\/rbac/ },
  { path: "/audit-trail", label: "Audit Trail", match: /^\/audit-trail/ },
  { path: "/settings", label: "Settings", match: /^\/settings/ },
];

const SIDEBAR_VISIBILITY_KEY = "athena.console.sidebar.visible";
const MOBILE_BREAKPOINT = "(max-width: 900px)";

function isMobileViewport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(MOBILE_BREAKPOINT).matches;
}

function getInitialSidebarVisibility(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const persistedValue = window.localStorage.getItem(SIDEBAR_VISIBILITY_KEY);
  if (persistedValue) {
    try {
      return JSON.parse(persistedValue) as boolean;
    } catch {
      return !isMobileViewport();
    }
  }

  return !isMobileViewport();
}

function toBreadcrumb(pathname: string): string[] {
  if (pathname === "/") {
    return ["Dashboard"];
  }

  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1));
}

export function AppLayout() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState<boolean>(() => isMobileViewport());
  const [isSidebarVisible, setSidebarVisible] = usePersistentState<boolean>(
    SIDEBAR_VISIBILITY_KEY,
    getInitialSidebarVisibility,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = window.matchMedia(MOBILE_BREAKPOINT);
    const handleChange = () => {
      const mobile = query.matches;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarVisible(false);
      }
    };

    handleChange();
    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, [setSidebarVisible]);

  const breadcrumb = useMemo(
    () => toBreadcrumb(location.pathname),
    [location.pathname],
  );

  const activeNav = navItems.find((item) => item.match.test(location.pathname));
  const title = activeNav?.label ?? "Console";

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${
          isSidebarVisible ? styles.sidebarOpen : styles.sidebarClosed
        }`}
      >
        <div className={styles.sidebarHeader}>
          <p className={styles.brand}>ProjectAthena</p>
          <p className={styles.brandSubtle}>Console</p>
        </div>
        <nav className={styles.nav} aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }: { isActive: boolean }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
              }
              end={item.path === "/"}
              onClick={() => {
                if (isMobile) {
                  setSidebarVisible(false);
                }
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {isMobile && isSidebarVisible ? (
        <button
          type="button"
          className={styles.overlay}
          aria-label="Close navigation"
          onClick={() => setSidebarVisible(false)}
        />
      ) : null}

      <div className={styles.mainColumn}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setSidebarVisible(!isSidebarVisible)}
              aria-label="Toggle navigation"
            >
              <Menu size={18} />
            </button>
            <div>
              <h1 className={styles.pageTitle}>{title}</h1>
              <p className={styles.breadcrumb}>{breadcrumb.join(" / ")}</p>
            </div>
          </div>

          <div className={styles.headerRight}>
            <label className={styles.searchBox}>
              <Search size={16} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search run_01HF... or session_01HF..."
                aria-label="Global search"
              />
            </label>
            <button type="button" className={styles.iconButton} aria-label="Settings">
              <Settings size={16} />
            </button>
          </div>
        </header>

        <main className={styles.detailPane}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
