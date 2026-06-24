import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

// Volcengine RTC SDK throws _SDKError: disconnect internally when destroying an
// already-disconnected engine. This is a known SDK issue that cannot be caught
// with try/catch (it fires from an internal async callback). Suppress it here.
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message ?? event.reason ?? '')
  if (msg.includes('disconnect') || msg.includes('_SDKError')) {
    event.preventDefault()
  }
})

createRoot(document.getElementById('root')!).render(<App />)
