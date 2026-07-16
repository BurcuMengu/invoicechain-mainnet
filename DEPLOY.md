# InvoiceChain — Mainnet Launch Runbook (Adım 1 → 4)

Bu, InvoiceChain'i mainnet'e çıkarmanın **sıralı** operatör kılavuzudur. Adımlar
bağımlıdır — **sırayla** yap. `[U]` = yalnızca sen yapabilirsin (gerçek para/hesap/
karar). Kod ve scriptler hazır; burada onları çalıştırıyorsun.

> Ön koşul: WS0 audit ✅, kontrat fix'leri `master`'da ✅. Aşağıdaki her şey
> `master` üzerinden çalışır.

---

## Adım 1 — Mainnet deploy `[U]`  ⬅️ ASIL KAPI

Fix'li kontratları mainnet'e (pubnet) çıkarır. `scripts/deploy_mainnet.sh` gerçek
**USDC SAC**'ı kullanır (mock deploy edilmez, audit IC-01) ve wiring'i doğrular (IC-09).

### 1a. Admin anahtarını hazırla (DD-2 — güvenlik için kritik)
Admin; upgrade / pause / set_reputation yetkisini taşır. **Deployer hot-key'i admin
yapma** — en az bir donanım cüzdanı, tercihen multisig kullan.

- **Minimum:** donanım cüzdanı (Ledger) adresini admin yap.
- **Önerilen (multisig):** Bir Stellar hesabına ek signer'lar ekleyip eşikleri
  yükselt (set_options: `--signer`, `--med-threshold`, `--high-threshold`). Modern
  CLI'da: `stellar tx new set-options --help` ile flag'leri gör; ya da
  [Stellar Laboratory](https://laboratory.stellar.org) → "Set Options" ile 2-of-3 kur.
- Sonuç: `ADMIN_ADDR` = bu (multisig/HW) hesabın G-adresi.

### 1b. stellar CLI'da mainnet ağını tanımla
```bash
stellar network add mainnet \
  --rpc-url https://mainnet.sorobanrpc.com \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

### 1c. Fonlanmış bir deployer anahtarı hazırla
```bash
stellar keys generate deployer-mainnet --network mainnet   # mainnet'te otomatik fonlanmaz
stellar keys address deployer-mainnet
# ↑ bu adrese bir borsadan/cüzdandan birkaç XLM gönder (deploy ücretleri için)
```

### 1d. Deploy'u çalıştır
```bash
cd ~/invoicechain-mainnet
ADMIN_ADDR=<multisig-veya-HW-adresin> ./scripts/deploy_mainnet.sh deployer-mainnet
# Script: USDC SAC'ı türetir, marketplace + reputation deploy eder, wiring'i
# doğrular (reputation != token) ve "DEPLOY MAINNET" onayı ister.
```

### 1e. Sonucu doğrula
```bash
cat deployments/mainnet.json     # marketplace / reputation / token id'leri
```
Bu id'ler Adım 2 ve 3'te lazım. `deployments/mainnet.json`'ı commit'le (adresler public).

---

## Adım 2 — Prod frontend (mainnet) `[C→U]`  (Adım 1 gerektirir)

Frontend kodu **env-driven** hazır (`frontend/src/lib/config.ts`) — sadece env
doldurup build/deploy edeceksin. Kod değişikliği yok.

### 2a. Mainnet env'ini ayarla
`frontend/.env` (veya CI/Pages env) içine, `mainnet.json`'daki id'lerle:
```bash
VITE_NETWORK=mainnet
VITE_MARKETPLACE_ID=<mainnet.json marketplace>
VITE_TOKEN_ID=<mainnet.json token (USDC SAC)>
VITE_REPUTATION_ID=<mainnet.json reputation>
# VITE_RPC_URL / VITE_NETWORK_PASSPHRASE opsiyonel (mainnet default'ları var)
```
> `VITE_NETWORK=mainnet` olunca faucet/ramp UI otomatik gizlenir (`config.faucetEnabled=false`)
> ve mainnet RPC/passphrase kullanılır. Kullanıcılar gerçek USDC trustline'ı cüzdanlarında ekler.

### 2b. Build + deploy
```bash
cd frontend && npm ci && npm run build     # dist/ üretir
# mevcut GitHub Pages akışıyla ya da tercih ettiğin host ile yayınla
```
> Not: Bu repo public olduğunda Pages otomatik deploy tetiklenebilir (bkz. Adım 4).

---

## Adım 3 — Sponsor Worker deploy (gasless) `[U]`  (Adım 1 gerektirir)

Gasless onboarding'i açar. Ayrıntılı runbook: `sponsor-worker/README.md`.

### 3a. Launchtube token'ı edin
[launchtube.xyz](https://launchtube.xyz) mainnet endpoint'i için bir token al.

### 3b. Worker'ı yapılandır + deploy et
```bash
cd ~/invoicechain-mainnet/sponsor-worker && npm install
npx wrangler kv namespace create RL          # çıkan id'yi wrangler.toml'a yaz
# wrangler.toml [vars]: MARKETPLACE_ID + TOKEN_ID = mainnet.json değerleri,
#   ALLOWED_ORIGIN = yayınlanan frontend origin'i (ör. https://burcumengu.github.io)
npx wrangler secret put LAUNCHTUBE_URL        # mainnet Launchtube endpoint
npx wrangler secret put LAUNCHTUBE_TOKEN      # token — asla commit etme
npx wrangler deploy
```

### 3c. Frontend'i Worker'a bağla
`frontend/.env`'e ekle ve yeniden build et (Adım 2b):
```bash
VITE_SPONSOR_URL=https://invoicechain-sponsor.<subdomain>.workers.dev
```

---

## Adım 4 — Repo'yu public yap `[U]`  (Adım 1'den SONRA)

Level 6 R1'i karşılar ve branch protection'ı ücretsiz açar. **Mainnet deploy'dan
önce yapma** — audit, hâlâ-canlı zafiyetli kontratlara karşı yayınlanmasın.

### 4a. Yayın öncesi kontrol listesi
- [ ] Mainnet deploy tamam, fix'li kontratlar canlı (Adım 1).
- [ ] Repo'da gerçek secret yok (`git grep -nE "S[A-Z2-7]{55}"` boş; Launchtube token
      yalnızca `wrangler secret` ile, commit'te değil).
- [ ] `deployments/mainnet.json` (public adresler) commit'li.

### 4b. Görünürlüğü değiştir
GitHub → repo **Settings → General → Danger Zone → Change repository visibility → Public**.

### 4c. Branch protection'ı aç (artık ücretsiz)
GitHub → **Settings → Branches → Add rule** (branch: `master`):
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → **`contracts`** + **`frontend`** seç
- ✅ Require branches to be up to date before merging
- ✅ Block force pushes

---

## Adım 4'ten sonra (bu runbook dışı)
- **WS4:** 20+ gerçek kullanıcı + on-chain tx (canlı app gerektirir).
- **WS6:** Twitter launch thread / demo video / ekosistem blog — taslaklar hazırlanır, sonra yayınlanır.
- **WS7:** `SUBMISSION.md`'de tüm kanıtları topla.
