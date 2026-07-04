# User Feedback Summary

## How feedback is collected

InvoiceChain has an in-app **feedback widget** (the 💬 button, bottom-left of
every page). Users leave a 1–5 star rating and a short message. Submissions are:

- sent to **PostHog** as a `feedback_submitted` event (rating + message), viewable
  in the project's Activity view, and
- saved to `localStorage` as a no-backend fallback so nothing is lost.

No wallet connection is required to leave feedback, so any visitor can respond.

## Responses so far

**4 responses · average rating ★5.0**

| Rating | Feedback | Device |
|:---:|---|---|
| ★★★★★ | "Selling an invoice for instant cash in seconds is genuinely impressive. The discount/price math is clear." | Desktop |
| ★★★★★ | "Clean, functional and informative UI working seamlessly — great integrated wallet experience!" | Desktop |
| ★★★★★ | "Marketplace is easy to browse. Would be nice to sort/filter invoices by discount or amount." | Desktop |
| ★★★★★ | "Works well on mobile. A tooltip on 'settle' would help first-time users understand the step." | Mobile |

(Device is read from each event's PostHog properties — 3 desktop, 1 mobile.)

## What users liked

- **Speed / core value** — turning an invoice into instant cash "in seconds" landed as the standout.
- **Clarity** — the discount → price → settle math reads clearly.
- **UI & wallet experience** — described as clean, functional, and smoothly integrated.
- **Ease of browsing** the marketplace.

## Suggestions raised

- **Sort / filter the marketplace** by discount or amount (desktop user).
- **A tooltip on "settle"** to help first-time users understand the step
  (mobile user — confirming the flow works on mobile too).

Both are small usability-polish asks rather than blockers.

## Actions

- Planned for the next iteration: (1) add sorting/filtering to the Marketplace
  list (by discount %, face value, price), and (2) add an inline explainer /
  tooltip on the settle action.
- Continue collecting feedback as more users onboard; this summary is updated
  from the live `feedback_submitted` data.

> Note: testnet demo — feedback reflects the early user group. Collection is
> ongoing.
