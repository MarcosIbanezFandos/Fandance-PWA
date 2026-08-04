import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { GlobalProvider } from './context/GlobalContext'
import { installKeyboardFix } from './lib/keyboardFix'
import { installViewportLock } from './lib/viewportLock'
import { instalarAutoActualizacion, buscarActualizacionAlVolver } from './lib/actualizacion'

installKeyboardFix()
installViewportLock()
instalarAutoActualizacion()
buscarActualizacionAlVolver()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <GlobalProvider>
        <App />
      </GlobalProvider>
    </BrowserRouter>
  </StrictMode>,
)
