import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Landing } from './pages/Landing.tsx'

// Route split: the marketing landing lives at /, the toolkit itself at /app.
// App internals are untouched; vercel.json rewrites both paths to this bundle.
const isAppRoute = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAppRoute ? <App /> : <Landing />}
  </StrictMode>,
)
