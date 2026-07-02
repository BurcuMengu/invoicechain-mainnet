import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import WalletBar from './WalletBar'

const NAV_LINKS = [
  { to: '/', label: 'Marketplace', end: true },
  { to: '/create', label: 'Create' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/ramp', label: 'Ramp' },
]

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium px-1 pb-0.5 border-b-2 transition-colors ${
    isActive
      ? 'border-indigo-600 text-indigo-600'
      : 'border-transparent text-gray-600 hover:text-indigo-600 hover:border-indigo-300'
  }`

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <span className="text-lg font-bold text-indigo-600 shrink-0">InvoiceChain</span>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Wallet + hamburger */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <WalletBar />
            </div>
            {/* Hamburger — visible on small screens */}
            <button
              className="md:hidden p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3 space-y-3">
            <nav className="flex flex-col gap-3" aria-label="Mobile navigation">
              {NAV_LINKS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `text-sm font-medium py-1 ${isActive ? 'text-indigo-600' : 'text-gray-700 hover:text-indigo-600'}`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <WalletBar />
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto p-4">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
