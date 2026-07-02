import { render, screen } from '@testing-library/react'
import InvoiceCard from './InvoiceCard'
import type { Invoice } from '../hooks/useInvoices'

// 1000 USDC at 7 decimal places: 1000 * 10_000_000 = 10_000_000_000 stroops
const mockInvoice: Invoice = {
  id: 1n,
  seller: 'GSELLER000000000000000000000000000000000000000000000000000',
  debtor_name: 'Acme Corp',
  face_value: 10_000_000_000n,
  discount_bps: 500,   // 5%
  due_ledger: 5_000_000n,
  owner: 'GOWNER0000000000000000000000000000000000000000000000000000',
  status: { tag: 'Listed', values: undefined as void },
}

test('shows debtor name', () => {
  render(<InvoiceCard invoice={mockInvoice} />)
  expect(screen.getByText('Acme Corp')).toBeInTheDocument()
})

test('shows face value as 1000 USDC', () => {
  render(<InvoiceCard invoice={mockInvoice} />)
  // fromStroops(10_000_000_000n) = "1000"
  expect(screen.getByTestId('face-value').textContent).toContain('1000')
})

test('shows sale price after 5% discount (950 USDC)', () => {
  render(<InvoiceCard invoice={mockInvoice} />)
  // salePrice(10_000_000_000n, 500) = 9_500_000_000n → fromStroops = "950"
  expect(screen.getByTestId('price').textContent).toContain('950')
})

test('shows discount percentage', () => {
  render(<InvoiceCard invoice={mockInvoice} />)
  // bpsToPercent(500) = "5" → displays as "5%"
  expect(screen.getByTestId('discount').textContent).toContain('5%')
})

test('renders status badge', () => {
  render(<InvoiceCard invoice={mockInvoice} />)
  expect(screen.getByText('Listed')).toBeInTheDocument()
})

test('renders children action slot', () => {
  render(
    <InvoiceCard invoice={mockInvoice}>
      <button>Buy</button>
    </InvoiceCard>,
  )
  expect(screen.getByRole('button', { name: 'Buy' })).toBeInTheDocument()
})
