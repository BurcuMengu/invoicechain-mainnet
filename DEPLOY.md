# InvoiceChain — Mainnet Launch Runbook (Step 1 → 4)

This is the **sequential** operator guide for taking InvoiceChain to mainnet. The steps
are dependent — do them **in order**. `[U]` = only you can do it (real money/account/
decision). The code and scripts are ready; here you're running them.

> Prerequisite: WS0 audit ✅, contract fixes on `master` ✅. Everything below runs off
> `master`.

---

## Step 1 — Mainnet deploy `[U]`  ⬅️ THE MAIN GATE

Deploys the fixed contracts to mainnet (pubnet). `scripts/deploy_mainnet.sh` uses the
real **USDC SAC** (no mock is deployed, audit IC-01) and verifies the wiring (IC-09).

### 1a. Prepare the admin key (DD-2 — critical for security)
The admin holds the upgrade / pause / set_reputation authority. **Do not make the
deployer hot-key the admin** — use at least a hardware wallet, preferably a multisig.

- **Minimum:** make a hardware wallet (Ledger) address the admin.
- **Recommended (multisig):** add extra signers to a Stellar account and raise the
  thresholds (set_options: `--signer`, `--med-threshold`, `--high-threshold`). In the
  modern CLI: see the flags with `stellar tx new set-options --help`; or set up a 2-of-3
  via [Stellar Laboratory](https://laboratory.stellar.org) → "Set Options".
- Result: `ADMIN_ADDR` = the G-address of this (multisig/HW) account.

### 1b. Define the mainnet network in the stellar CLI
```bash
stellar network add mainnet \
  --rpc-url https://mainnet.sorobanrpc.com \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

### 1c. Prepare a funded deployer key
```bash
stellar keys generate deployer-mainnet --network mainnet   # not auto-funded on mainnet
stellar keys address deployer-mainnet
# ↑ send a few XLM to this address from an exchange/wallet (for deploy fees)
```

### 1d. Run the deploy
```bash
cd ~/invoicechain-mainnet
ADMIN_ADDR=<your-multisig-or-HW-address> ./scripts/deploy_mainnet.sh deployer-mainnet
# Script: derives the USDC SAC, deploys marketplace + reputation, verifies the
# wiring (reputation != token), and asks for a "DEPLOY MAINNET" confirmation.
```

### 1e. Verify the result
```bash
cat deployments/mainnet.json     # marketplace / reputation / token ids
```
You'll need these ids in Steps 2 and 3. Commit `deployments/mainnet.json` (the addresses are public).

---

## Step 2 — Prod frontend (mainnet) `[C→U]`  (requires Step 1)

The frontend code is ready and **env-driven** (`frontend/src/lib/config.ts`) — you just
fill in the env and build/deploy. No code changes.

### 2a. Set up the mainnet env
In `frontend/.env` (or CI/Pages env), with the ids from `mainnet.json`:
```bash
VITE_NETWORK=mainnet
VITE_MARKETPLACE_ID=<mainnet.json marketplace>
VITE_TOKEN_ID=<mainnet.json token (USDC SAC)>
VITE_REPUTATION_ID=<mainnet.json reputation>
# VITE_RPC_URL / VITE_NETWORK_PASSPHRASE optional (mainnet defaults exist)
```
> With `VITE_NETWORK=mainnet`, the faucet/ramp UI is hidden automatically (`config.faucetEnabled=false`)
> and the mainnet RPC/passphrase is used. Users add the real USDC trustline in their own wallets.

### 2b. Build + deploy
```bash
cd frontend && npm ci && npm run build     # produces dist/
# publish via the existing GitHub Pages flow or the host of your choice
```
> Note: When this repo goes public, a Pages auto-deploy may be triggered (see Step 4).

---

## Step 3 — Sponsor Worker deploy (gasless) `[U]`  (requires Step 1)

Enables gasless onboarding. Detailed runbook: `sponsor-worker/README.md`.

### 3a. Obtain a Launchtube token
Get a token for the mainnet endpoint at [launchtube.xyz](https://launchtube.xyz).

### 3b. Configure + deploy the Worker
```bash
cd ~/invoicechain-mainnet/sponsor-worker && npm install
npx wrangler kv namespace create RL          # write the resulting id into wrangler.toml
# wrangler.toml [vars]: MARKETPLACE_ID + TOKEN_ID = mainnet.json values,
#   ALLOWED_ORIGIN = the published frontend origin (e.g. https://burcumengu.github.io)
npx wrangler secret put LAUNCHTUBE_URL        # mainnet Launchtube endpoint
npx wrangler secret put LAUNCHTUBE_TOKEN      # token — never commit
npx wrangler deploy
```

### 3c. Connect the frontend to the Worker
Add to `frontend/.env` and rebuild (Step 2b):
```bash
VITE_SPONSOR_URL=https://invoicechain-sponsor.<subdomain>.workers.dev
```

---

## Step 4 — Make the repo public `[U]`  (AFTER Step 1)

Satisfies Level 6 R1 and enables branch protection for free. **Don't do it before the
mainnet deploy** — the audit should not be published against still-live vulnerable contracts.

### 4a. Pre-publish checklist
- [ ] Mainnet deploy done, fixed contracts live (Step 1).
- [ ] No real secrets in the repo (`git grep -nE "S[A-Z2-7]{55}"` is empty; the Launchtube
      token only via `wrangler secret`, not in a commit).
- [ ] `deployments/mainnet.json` (public addresses) committed.

### 4b. Change visibility
GitHub → repo **Settings → General → Danger Zone → Change repository visibility → Public**.

### 4c. Enable branch protection (now free)
GitHub → **Settings → Branches → Add rule** (branch: `master`):
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → select **`contracts`** + **`frontend`**
- ✅ Require branches to be up to date before merging
- ✅ Block force pushes

---

## After Step 4 (outside this runbook)
- **WS4:** 20+ real users + on-chain tx (requires the live app).
- **WS6:** Twitter launch thread / demo video / ecosystem blog — drafts are prepared, then published.
- **WS7:** Gather all the evidence in `SUBMISSION.md`.
