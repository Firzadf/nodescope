import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { resolveRoute, ROUTE_TITLES, type RouteId } from './utils/routes.ts'
import { App, DocsPage, FeesPage, JudgesPage, Landing, MainnetProfile, NotFoundPage, VerifyPage } from './lazyRoutes.ts'

// Route split: the marketing landing lives at /, the toolkit itself at /app,
// public report verification at /verify, the honest mainnet info page
// at /mainnet, the docs at /docs, the judges page at /judges, and the
// fees sub-landing at /fees. vercel.json rewrites all paths to this bundle.
//
// Each route is lazy-loaded (see lazyRoutes.ts) so a visitor to / or
// /fees never downloads the toolkit, the docs, or the other pages: before
// this split the first load carried every page (Lighthouse flagged
// ~100 kB unused JavaScript on /). The fallback is a blank dark screen,
// same background as every page, so there is no flash of unstyled
// content while the chunk loads.
const route: RouteId = resolveRoute(window.location.pathname)

// One title per route, so shared tabs and history entries name the page
// the visitor actually opened instead of repeating the landing title.
document.title = ROUTE_TITLES[route]

const page =
  route === 'app' ? <App />
  : route === 'verify' ? <VerifyPage />
  : route === 'mainnet' ? <MainnetProfile />
  : route === 'docs' ? <DocsPage />
  : route === 'judges' ? <JudgesPage />
  : route === 'fees' ? <FeesPage />
  : route === 'landing' ? <Landing />
  : <NotFoundPage />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>{page}</Suspense>
  </StrictMode>,
)
