import { render, screen } from '@testing-library/react'
import { WalletProvider } from './lib/WalletContext'
import { ToastProvider } from './lib/ToastContext'
import App from './App'

test('renders brand', () => {
  render(
    <WalletProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </WalletProvider>,
  )
  expect(screen.getByText('InvoiceChain')).toBeInTheDocument()
})
