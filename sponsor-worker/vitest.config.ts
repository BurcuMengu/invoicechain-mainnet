import { defineConfig } from 'vitest/config'

// Plain vitest (node env): the logic (validate + fetch/KV via injected doubles) does
// not require the workerd runtime. The worker test injects an in-memory KV double and
// stubs global fetch, so the Cloudflare workers pool is unnecessary here.
export default defineConfig({
  test: {
    environment: 'node',
  },
})
