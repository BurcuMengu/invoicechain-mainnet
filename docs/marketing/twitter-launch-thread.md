# Twitter/X Launch Thread — InvoiceChain (R9)

> Usage: each numbered block is one tweet. Fill in the `[…]` placeholders at
> publish time (mainnet links go live after deploy). Tag the Stellar ecosystem
> accounts: **@StellarOrg @BuildOnStellar @DefinitelyStellar**. For visuals, add the
> demo GIF (`docs/demo.gif`) to tweet 1, and screenshots to the following tweets.

---

**1/ 🧾⚡ Introducing InvoiceChain — an invoice factoring marketplace built on Stellar/Soroban.**

Businesses turn unpaid invoices into cash today; investors buy them at a discount and earn yield. All on-chain, with **gasless onboarding** — new users can start without holding a single XLM for fees.

🔗 Demo: [burcumengu.github.io/invoicechain](https://burcumengu.github.io/invoicechain)
🧵👇

**2/ The problem:** cash flow for SMBs. An invoice gets paid in 30–90 days, but the money is needed today. Traditional factoring is slow, full of middlemen, and opaque.

**The solution:** tokenize the invoice, sell it at a discount, and when the debtor pays, the investor collects the full amount. No intermediaries, transparent, instant.

**3/ How it works (create → buy → settle):**
• The seller lists an invoice (face value, discount, due date, **debtor address**)
• An investor buys at the discounted price → funds go straight to the seller
• The debtor pays the full amount at maturity → the investor collects, and the seller's **reputation** grows
• If it goes unpaid → default, and reputation drops

**4/ ⚡ The standout feature — gasless onboarding.**

The biggest wall in front of a new user: "first, go get some XLM." We tore it down.

A sponsor covers the network fee on your first transactions via a **Launchtube** fee-bump. The user just signs. XLM=0 in the wallet → still able to create/buy/settle.

**5/ 🔒 Security first.**

Before going to mainnet, we ran a multi-agent **adversarial security audit**: 10 findings, all addressed (no fund-theft, no reentrancy). Reputation inflation, DoS, and arithmetic safety were all fixed with TDD.

Full report in the repo: `SECURITY-AUDIT.md`

**6/ 🛠 Fully open source & Stellar-native:**
• 3 Soroban contracts (marketplace / reputation / SEP-41 token)
• React + Stellar Wallets Kit + @stellar/stellar-sdk
• Mainnet with real USDC (SAC)
• Gasless via Cloudflare Worker + Launchtube

Repo: [github.com/BurcuMengu/invoicechain-mainnet]

**7/ Try it, share feedback, contribute 🙌**

📱 Live demo: [link]
📖 User guide: `docs/USER-GUIDE.md`
📝 Technical write-up on how we built it: [blog link]

A small contribution to the Stellar ecosystem. Questions and PRs welcome!

#Stellar #Soroban #DeFi #RWA
