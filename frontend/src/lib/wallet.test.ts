import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useWallet } from './WalletContext'

describe('useWallet', () => {
  it('throws outside provider', () => {
    expect(() => renderHook(() => useWallet())).toThrow(/WalletProvider/)
  })
})
