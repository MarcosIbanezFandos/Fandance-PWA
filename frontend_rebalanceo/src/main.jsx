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
    {/* basename derivado del `base` de Vite: '' aquí (standalone, base '/') y
        '/fandance' en el despliegue fusionado dentro de FANDiOS. Sin la barra
        final: React Router no casa '/fandance' contra el basename '/fandance/'
        y se queda sin renderizar nada. */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <GlobalProvider>
        <App />
      </GlobalProvider>
    </BrowserRouter>
  </StrictMode>,
)
