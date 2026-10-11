import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { AuthProvider, RefProvider } from './state/auth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RefProvider>
          <App />
        </RefProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
