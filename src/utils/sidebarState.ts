/**
 * Initial sidebar state for the /app workspace.
 *
 * A stored per-tab preference always wins. Without one, a narrow viewport
 * starts collapsed: the expanded sidebar is 256px wide, which would leave
 * about 86px for content on a 390px phone screen. The user can still expand
 * with the toggle, and that choice is then stored for the tab.
 */
export function initialSidebarCollapsed(): boolean {
  try {
    const stored = sessionStorage.getItem('nodescope-sidebar-collapsed');
    if (stored !== null) return stored === '1';
  } catch {
    // A stored preference is best effort; fall through to the viewport default.
  }
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 767px)').matches
  );
}
