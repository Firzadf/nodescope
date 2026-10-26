import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Landing } from './pages/Landing.tsx'
import { VerifyPage } from './pages/VerifyPage.tsx'
import { MainnetProfile } from './pages/MainnetProfile.tsx'
import { DocsPage } from './pages/DocsPage.tsx'
import { JudgesPage } from './pages/JudgesPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'

// Route split: the marketing landing lives at /, the toolkit itself at /app,
// public report verification at /verify, the honest mainnet info page
// at /mainnet, the docs at /docs, and the judges page at /judges.
// vercel.json rewrites all paths to this bundle.
const pathname = window.location.pathname
const isAppRoute = pathname === '/app' || pathname.startsWith('/app/')
const isVerifyRoute = pathname === '/verify' || pathname.startsWith('/verify/')
const isMainnetRoute = pathname === '/mainnet' || pathname.startsWith('/mainnet/')
const isDocsRoute = pathname === '/docs' || pathname.startsWith('/docs/')
const isJudgesRoute = pathname === '/judges' || pathname.startsWith('/judges/')
const isLandingRoute = pathname === '/' || pathname === '/index.html'
const isKnownRoute = isAppRoute || isVerifyRoute || isMainnetRoute || isDocsRoute || isJudgesRoute || isLandingRoute

// One title per route, so shared tabs and history entries name the page
// the visitor actually opened instead of repeating the landing title.
document.title = isAppRoute
  ? 'NodeScope App — Portaldot Node Health Diagnostics'
  : isVerifyRoute
    ? 'Verify a report — NodeScope'
    : isMainnetRoute
      ? 'Mainnet Profile — NodeScope'
      : isDocsRoute
        ? 'NodeScope Docs — Checks, schema, verification'
        : isJudgesRoute
          ? 'NodeScope for Judges — 60-second verification'
          : isKnownRoute
            ? 'NodeScope — Portaldot Node Health Diagnostics'
            : 'Page not found — NodeScope'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAppRoute ? <App /> : isVerifyRoute ? <VerifyPage /> : isMainnetRoute ? <MainnetProfile /> : isDocsRoute ? <DocsPage /> : isJudgesRoute ? <JudgesPage /> : isLandingRoute ? <Landing /> : <NotFoundPage />}
  </StrictMode>,
)
