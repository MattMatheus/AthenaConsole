export const DOCUMENTATION_ALIAS_PATH = "documentation";
export const DOCUMENTATION_CANONICAL_PATH = "/docs";
export const START_WORK_PATH = "/start";

export function resolveConsoleRedirect(pathname: string): string | undefined {
  return pathname === `/${DOCUMENTATION_ALIAS_PATH}` ? DOCUMENTATION_CANONICAL_PATH : undefined;
}
