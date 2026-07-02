import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { WalletProvider } from './lib/WalletContext'
import { ToastProvider } from './lib/ToastContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </WalletProvider>
  </React.StrictMode>,
)
