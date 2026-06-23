import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { Buffer } from 'buffer'
import ErrorBoundary from './components/ErrorBoundary'
import ToastProvider from './components/toast/ToastProvider'
import ConfirmProvider from './components/confirm/ConfirmProvider'
import './index.css'

if (typeof window !== 'undefined') {
  window.Buffer = Buffer
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
