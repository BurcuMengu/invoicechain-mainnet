# Twitter/X Launch Thread — InvoiceChain (R9)

> How to use: each numbered block is one tweet. Fill the `[...]` placeholders when you
> post (mainnet links after deploy). Tag the Stellar accounts: **@StellarOrg
> @BuildOnStellar**. Put the demo GIF (`docs/demo.gif`) on tweet 1 and screenshots on
> the next few tweets.

---

**1/** I built InvoiceChain: a way to sell your unpaid invoices for cash today, on Stellar.

A customer owes you money but won't pay for 60 days? List that invoice, someone buys it at a small discount, and you get paid now. All on-chain.

Demo: https://burcumengu.github.io/invoicechain
🧵

**2/** Why I made this: small businesses are always waiting on invoices. The money is coming, just not today, and today is when rent and payroll are due.

Regular invoice factoring is slow and full of middlemen. I wanted to see if Stellar could make it simpler.

**3/** How it works, plainly:

- You list an invoice: the amount, a discount, the due date, and who owes you
- An investor buys it at that discount and pays you right away
- When your customer pays, the investor gets the full amount
- If nobody pays by the due date, it's marked as defaulted

**4/** The part I'm happiest with: you don't need XLM to start.

Normally a new user has to go buy a bit of XLM just to cover network fees. That alone scares a lot of people off. So the first few actions are free to you — a sponsor pays the fee, you just sign.

**5/** I didn't want to touch mainnet without checking the code first.

So I put the contracts through a tough audit, found 10 issues, and fixed or documented every one. No way to steal funds, no reentrancy. The full report is in the repo.

**6/** It's open source and built on Stellar:

- 3 Soroban contracts
- React + Stellar Wallets Kit
- Real USDC on mainnet
- Gasless via Launchtube and a small Cloudflare Worker

Repo: https://github.com/BurcuMengu/invoicechain-mainnet

**7/** Have a look, try to break it, and tell me what's confusing.

Demo: https://burcumengu.github.io/invoicechain
How I built it: https://medium.com/@burcumengu/how-i-built-an-invoice-marketplace-on-stellar-and-made-it-work-without-xlm-d95598416e6

Feedback and PRs welcome 🙌

#Stellar #Soroban
