export const DOCUMENTATION_ALIAS_PATH = "documentation";
export const DOCUMENTATION_CANONICAL_PATH = "/docs";

export function resolveConsoleRedirect(pathname: string): string | undefined {
  return pathname === `/${DOCUMENTATION_ALIAS_PATH}` ? DOCUMENTATION_CANONICAL_PATH : undefined;
}
