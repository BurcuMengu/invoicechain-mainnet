import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type Toast = { id: number; kind: 'success' | 'error'; msg: string }

const Ctx = createContext<{ success: (m: string) => void; error: (m: string) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: 'success' | 'error', msg: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((t) => [...t, { id, kind, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])

  const api = {
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded shadow text-white text-sm max-w-xs break-words ${
              t.kind === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast must be used within ToastProvider')
  return v
}
