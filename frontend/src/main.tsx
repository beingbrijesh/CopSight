import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'
import { loggerService } from './lib/loggerService'

// Initialize system-wide audit telemetry
loggerService.initGlobalListeners()

createRoot(document.getElementById('root')!).render(
  <App />
)
