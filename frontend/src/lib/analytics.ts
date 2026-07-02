import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

/**
 * Analytics / monitoring facade.
 *
 * Everything here is *guarded*: Sentry and PostHog only initialize when their
 * respective env keys are present. Env vars are inlined at BUILD time by Vite
 * (`import.meta.env.VITE_*`). On the current live build no keys are set, so
 * `initAnalytics()` is a no-op and every helper below is a safe no-op too — the
 * app behaves exactly as it does today. None of these functions ever throw.
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let sentryOn = false
let posthogOn = false

/** True when PostHog analytics is active (keys present + initialized). */
export let analyticsEnabled = false

/** Re-export so callers can guard Sentry-specific calls without importing it. */
export { Sentry }

/**
 * localStorage flag: when set to '1', the user has opted out of product
 * analytics + session replay for this browser. Read defensively — localStorage
 * can throw (private mode, disabled cookies, SSR).
 */
const OPTOUT_KEY = 'ic_analytics_optout'

/** True when the user has opted out of analytics on this browser. */
export function hasOptedOut(): boolean {
  try {
    return localStorage.getItem(OPTOUT_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Opt out of product analytics + session replay for this browser. Sets the
 * persistent flag and, if PostHog is already running, tells it to stop
 * capturing and stop any active session recording. Best-effort, never throws.
 */
export function optOut(): void {
  try {
    localStorage.setItem(OPTOUT_KEY, '1')
  } catch {
    /* localStorage unavailable — flag can't persist, still stop capture below */
  }
  if (posthogOn) {
    try {
      posthog.opt_out_capturing()
      posthog.stopSessionRecording?.()
    } catch {
      /* never throw from analytics */
    }
  }
  posthogOn = false
  analyticsEnabled = false
}

/**
 * Re-enable product analytics for this browser. Clears the opt-out flag and, if
 * PostHog is present, resumes capturing. Best-effort, never throws.
 */
export function optIn(): void {
  try {
    localStorage.removeItem(OPTOUT_KEY)
  } catch {
    /* ignore */
  }
  try {
    posthog.opt_in_capturing?.()
  } catch {
    /* never throw from analytics */
  }
}

/**
 * Initialize Sentry and/or PostHog if their keys are present. Safe to call
 * once at startup. If neither key is present, does nothing.
 */
export function initAnalytics(): void {
  if (SENTRY_DSN) {
    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: 0.1,
        environment: 'testnet',
      })
      sentryOn = true
    } catch (e) {
      // Never let monitoring setup break the app.
      console.error('Sentry init failed', e)
    }
  }

  // Respect the analytics opt-out: skip PostHog (analytics + session replay)
  // entirely. Sentry error monitoring above stays on — it only captures errors.
  if (POSTHOG_KEY && !hasOptedOut()) {
    try {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        capture_pageview: true,
      })
      posthogOn = true
      analyticsEnabled = true
    } catch (e) {
      console.error('PostHog init failed', e)
    }
  }
}

/** Capture a product analytics event. No-op unless PostHog is initialized. */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!posthogOn) return
  try {
    posthog.capture(event, props)
  } catch {
    /* never throw from analytics */
  }
}

/**
 * Attribute subsequent events to a wallet address. No-op unless PostHog is on.
 * Helps make wallet interactions attributable.
 */
export function identifyWallet(address: string): void {
  if (!posthogOn) return
  try {
    posthog.identify(address)
  } catch {
    /* never throw from analytics */
  }
}

/**
 * Report an error. ALWAYS logs to the browser console (so failures are visible
 * during debugging, even when Sentry is active) AND reports to Sentry when
 * monitoring is enabled. Never throws.
 */
export function captureError(e: unknown, context?: Record<string, unknown>): void {
  // Always surface in the console for debugging visibility.
  console.error('[InvoiceChain]', e, context ?? '')
  if (sentryOn) {
    try {
      Sentry.captureException(e, context ? { extra: context } : undefined)
    } catch {
      /* never throw from monitoring */
    }
  }
}
