import '@testing-library/jest-dom'

// jsdom doesn't implement window.matchMedia, but some deps (WalletConnect's
// modal, pulled in transitively by wallet.ts) call it at import time. Provide a
// no-op polyfill so those modules load in the test environment.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
