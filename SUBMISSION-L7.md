# InvoiceChain — Level 7 (Founder Belt) Submission

An **invoice factoring marketplace** on Stellar/Soroban: businesses tokenize
unpaid invoices and sell them at a discount, investors buy them for yield, and
when the debtor pays the investor collects the full face value — with **gasless
onboarding**.

- **Repo:** https://github.com/BurcuMengu/invoicechain-mainnet
- **Live app (mainnet):** https://burcumengu.github.io/invoicechain-mainnet/
- **User guide:** [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md)
- **Security audit:** [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md)
- **Level 6 (Black Belt) submission:** [`SUBMISSION.md`](SUBMISSION.md)

> **Level 7 focus:** sustainable growth, retention, and product-market fit.
> The product is live on mainnet; growth items (50+ users, 50+ followers) are
> in progress and marked ⏳ below — reported honestly, not pre-filled.

## Requirement traceability matrix

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Public GitHub repository | ✅ | [repo](https://github.com/BurcuMengu/invoicechain-mainnet) |
| 2 | 30+ meaningful commits | ✅ | **125+ commits** (`git rev-list --count HEAD`) |
| 3 | Live production application | ✅ | [burcumengu.github.io/invoicechain-mainnet](https://burcumengu.github.io/invoicechain-mainnet/) |
| 4 | Proof of 50+ new mainnet users | ⏳ | onboarding form + on-chain wallets — growth ongoing |
| 5 | Mainnet transaction proof | ✅ | [buy_invoice tx (0.9 USDC)](https://stellar.expert/explorer/public/tx/d10a037aff2c95aeb43055dc6ecf6470395e3e12d361cf05b9344d6f79c2b3e1) + [create](https://stellar.expert/explorer/public/tx/9e314ad31e9dfa8d3d5ebe4f797880345a96e3da8b1041965e581612d6245000) / [approve](https://stellar.expert/explorer/public/tx/df5b8f4d509c294212c3330c341468c44f4c7161ac6d4298e57dc6c96edab55f) / [deploy](https://stellar.expert/explorer/public/tx/c20b4f1b2aafd4ebbd431e5ad85669e0e6c6a4bdb6dc20a6ee3e98ff97a56cff) |
| 6 | User feedback sheet | ✅ | [`docs/feedback-responses.csv`](docs/feedback-responses.csv) (anonymized) |
| 7 | Product improvement commit links | ✅ | [`FEEDBACK.md`](FEEDBACK.md) — feedback → shipped table |
| 8 | Monthly growth report | ✅ | [`docs/growth/2026-08.md`](docs/growth/2026-08.md) |
| 9 | Social media growth (50+ followers) | ⏳ | [X profile](https://x.com/i/status/2078129791467753970) — growth ongoing |
| 10 | Product update posts | ✅ | [launch thread](https://x.com/i/status/2078129791467753970) + [product update: mainnet + marketplace sorting](https://x.com/BurcuMengu_/status/2094445926685225390) + [Medium](https://medium.com/@burcumengu/how-i-built-an-invoice-marketplace-on-stellar-and-made-it-work-without-xlm-d95598416e6c) |
| 11 | Community contribution proof | ✅ | [Medium article](https://medium.com/@burcumengu/how-i-built-an-invoice-marketplace-on-stellar-and-made-it-work-without-xlm-d95598416e6c) — an ecosystem how-to on building a gasless Soroban app |
| 12 | Updated documentation | ✅ | README, `docs/`, specs, [`DEPLOY.md`](DEPLOY.md) |

**Status: 10 ✅ · 2 ⏳ pending (50+ users & 50+ followers — growth in progress).**

## Mainnet deployment

| Contract | Address |
|---|---|
| Marketplace | [`CD76…RI53F`](https://stellar.expert/explorer/public/contract/CD76S7XCNIC3Q64JKKX66YS4PQA4QLRKATRAGK6HZBC5KGKDSMFRI53F) |
| Reputation | [`CBP6…NXX4F`](https://stellar.expert/explorer/public/contract/CBP63ILG2LEVJLQYADHZFNV3YDT4FRVG3O4E76ENNKMLI4XE54BNXX4F) |
| Token | canonical USDC SAC (`CCW6…MI75`) |

Full details in [`deployments/mainnet.json`](deployments/mainnet.json).

## Growth & traction

- **Monthly growth reports:** [`docs/growth/`](docs/growth/) — on-chain traction,
  product updates, feedback highlights, and goals, refreshed each month.
- **On-chain metrics:** regenerate anytime with `./scripts/growth_metrics.sh`.
- **Feedback loop:** in-app 💬 widget + Google sign-up form → anonymized public
  sheet ([`docs/feedback-responses.csv`](docs/feedback-responses.csv)); shipped
  improvements are tracked in [`FEEDBACK.md`](FEEDBACK.md).

---

*Living checklist — the ⏳ items will have their evidence filled in as growth
progresses. No metric is claimed without verifiable proof.*
