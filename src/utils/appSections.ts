// Section <-> URL sync (no router dependency: the app switches on state,
// and the URL is kept in step with replaceState so a section is linkable
// and reloadable). Unknown /app paths fall back to overview, as before;
// trailing slashes are normalized so /app/fee-lab/ opens Fee Lab.
export const SECTION_PATHS: Record<string, string> = {
  overview: '/app',
  diagnostics: '/app/diagnostics',
  history: '/app/history',
  'fee-lab': '/app/fee-lab',
};

export function sectionFromPath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const found = Object.entries(SECTION_PATHS).find(([, path]) => path === normalized);
  return found ? found[0] : 'overview';
}

export function pathForSection(section: string): string {
  return SECTION_PATHS[section] ?? '/app';
}
