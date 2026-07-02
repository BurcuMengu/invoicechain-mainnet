import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WalletProvider } from '../lib/WalletContext'
import { ToastProvider } from '../lib/ToastContext'
import Layout from './Layout'

function renderLayout() {
  return render(
    <WalletProvider>
      <ToastProvider>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </ToastProvider>
    </WalletProvider>,
  )
}

test('renders four nav links', () => {
  renderLayout()
  expect(screen.getAllByRole('link', { name: 'Marketplace' })).not.toHaveLength(0)
  expect(screen.getAllByRole('link', { name: 'Create' })).not.toHaveLength(0)
  expect(screen.getAllByRole('link', { name: 'Portfolio' })).not.toHaveLength(0)
  expect(screen.getAllByRole('link', { name: 'Ramp' })).not.toHaveLength(0)
})

test('renders brand', () => {
  renderLayout()
  expect(screen.getByText('InvoiceChain')).toBeInTheDocument()
})

test('renders connect wallet button when not connected', () => {
  renderLayout()
  expect(screen.getAllByRole('button', { name: /connect wallet/i })).not.toHaveLength(0)
})
