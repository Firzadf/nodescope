import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Landing } from './pages/Landing.tsx'
import { VerifyPage } from './pages/VerifyPage.tsx'
import { MainnetProfile } from './pages/MainnetProfile.tsx'
import { DocsPage } from './pages/DocsPage.tsx'
import { JudgesPage } from './pages/JudgesPage.tsx'
import { FeesPage } from './pages/FeesPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { resolveRoute, ROUTE_TITLES, type RouteId } from './utils/routes.ts'

// Route split: the marketing landing lives at /, the toolkit itself at /app,
// public report verification at /verify, the honest mainnet info page
// at /mainnet, the docs at /docs, the judges page at /judges, and the
// fees sub-landing at /fees. vercel.json rewrites all paths to this bundle.
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
    {page}
  </StrictMode>,
)
