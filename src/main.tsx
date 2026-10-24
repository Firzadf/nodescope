import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Landing } from './pages/Landing.tsx'
import { VerifyPage } from './pages/VerifyPage.tsx'
import { MainnetProfile } from './pages/MainnetProfile.tsx'

// Route split: the marketing landing lives at /, the toolkit itself at /app,
// public report verification at /verify, and the honest mainnet info page
// at /mainnet. vercel.json rewrites all paths to this bundle.
const pathname = window.location.pathname
const isAppRoute = pathname === '/app' || pathname.startsWith('/app/')
const isVerifyRoute = pathname === '/verify' || pathname.startsWith('/verify/')
const isMainnetRoute = pathname === '/mainnet' || pathname.startsWith('/mainnet/')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAppRoute ? <App /> : isVerifyRoute ? <VerifyPage /> : isMainnetRoute ? <MainnetProfile /> : <Landing />}
  </StrictMode>,
)
