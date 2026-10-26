/**
 * Route components, lazy-loaded.
 *
 * Kept in its own module (rather than main.tsx) so the fast-refresh lint
 * rule stays quiet: this file exports only components. main.tsx picks
 * one by route and renders it inside Suspense. Splitting here is what
 * keeps / and /fees from downloading the toolkit, the docs, and every
 * other page on first load.
 */
import { lazy } from 'react';

export const App = lazy(() => import('./App.tsx'));
export const Landing = lazy(() => import('./pages/Landing.tsx').then((m) => ({ default: m.Landing })));
export const VerifyPage = lazy(() =>
  import('./pages/VerifyPage.tsx').then((m) => ({ default: m.VerifyPage })),
);
export const MainnetProfile = lazy(() =>
  import('./pages/MainnetProfile.tsx').then((m) => ({ default: m.MainnetProfile })),
);
export const DocsPage = lazy(() => import('./pages/DocsPage.tsx').then((m) => ({ default: m.DocsPage })));
export const JudgesPage = lazy(() =>
  import('./pages/JudgesPage.tsx').then((m) => ({ default: m.JudgesPage })),
);
export const FeesPage = lazy(() => import('./pages/FeesPage.tsx').then((m) => ({ default: m.FeesPage })));
export const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage.tsx').then((m) => ({ default: m.NotFoundPage })),
);
