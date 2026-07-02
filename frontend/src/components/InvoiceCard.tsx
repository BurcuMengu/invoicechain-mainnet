import { ReactNode } from 'react'
import { fromStroops, bpsToPercent, salePrice } from '../lib/format'
import { statusLabel } from '../hooks/useInvoices'
import type { Invoice } from '../hooks/useInvoices'

const STATUS_BADGE: Record<string, string> = {
  Listed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Funded: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Settled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  Defaulted: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  Cancelled: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
}

interface InvoiceCardProps {
  invoice: Invoice
  children?: ReactNode
}

export default function InvoiceCard({ invoice, children }: InvoiceCardProps) {
  const label = statusLabel(invoice.status)
  const price = salePrice(invoice.face_value, invoice.discount_bps)
  const badgeClass = STATUS_BADGE[label] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-900 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3
          className="font-semibold text-gray-900 dark:text-gray-100 text-base leading-tight truncate"
          title={invoice.debtor_name}
        >
          {invoice.debtor_name}
        </h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
          {label}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500 dark:text-gray-400">Face value</dt>
        <dd
          className="text-gray-900 dark:text-gray-100 font-mono text-right"
          data-testid="face-value"
        >
          {fromStroops(invoice.face_value)} USDC
        </dd>

        <dt className="text-gray-500 dark:text-gray-400">Discount</dt>
        <dd
          className="text-gray-900 dark:text-gray-100 text-right"
          data-testid="discount"
        >
          {bpsToPercent(invoice.discount_bps)}%
        </dd>

        <dt className="text-gray-500 dark:text-gray-400">Price</dt>
        <dd
          className="text-gray-900 dark:text-gray-100 font-mono font-semibold text-right"
          data-testid="price"
        >
          {fromStroops(price)} USDC
        </dd>
      </dl>

      {children && <div className="mt-1">{children}</div>}
    </div>
  )
}
