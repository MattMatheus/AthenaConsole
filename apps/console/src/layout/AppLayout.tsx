import {
  Menu,
  Search,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { navItems, navSections, type NavItem } from "../app/navigationModel";
import { usePersistentState } from "../hooks";
import styles from "./AppLayout.module.css";

const SIDEBAR_VISIBILITY_KEY = "athena.console.sidebar.visible";
const MOBILE_BREAKPOINT = "(max-width: 768px)";

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

function toBreadcrumb(pathname: string, activeNav?: NavItem): string[] {
  if (pathname === "/") {
    return ["Dashboard"];
  }

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1));

  if (activeNav) {
    return [activeNav.label, ...segments.slice(1)];
  }

  return segments;
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
      setSidebarVisible(!mobile);
    };

    handleChange();
    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, [setSidebarVisible]);

  const activeNav = navItems.find((item) => item.match.test(location.pathname));
  const title = activeNav?.label ?? "Console";
  const breadcrumb = useMemo(
    () => toBreadcrumb(location.pathname, activeNav),
    [activeNav, location.pathname],
  );

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${
          isSidebarVisible ? styles.sidebarOpen : styles.sidebarClosed
        }`}
      >
        <div className={styles.sidebarHeader}>
          <p className={styles.brand}>Team Orchestrator</p>
          <p className={styles.brandSubtle}>Console</p>
        </div>
        <nav className={styles.nav} aria-label="Console">
          {navSections.map((section) => (
            <section className={styles.navSection} key={section.label} aria-label={section.label}>
              <p className={styles.navSectionLabel}>{section.label}</p>
              <div className={styles.navSectionItems}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
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
                      <Icon size={16} className={styles.navIcon} aria-hidden />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </section>
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
              onClick={() => setSidebarVisible(true)}
              aria-expanded={isSidebarVisible}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <div>
              <h1 className={styles.pageTitle}>{title}</h1>
              {breadcrumb.length > 1 ? (
                <p className={styles.breadcrumb}>{breadcrumb.join(" / ")}</p>
              ) : null}
            </div>
          </div>

          <div className={styles.headerRight}>
            <label className={styles.searchBox}>
              <Search size={16} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search runs, agents, sessions…"
                aria-label="Global search"
              />
            </label>
            <Link to="/settings" className={styles.iconButton} aria-label="Open settings">
              <Settings size={16} />
            </Link>
          </div>
        </header>

        <main className={styles.detailPane}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
