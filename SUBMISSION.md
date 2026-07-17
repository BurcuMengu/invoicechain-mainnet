# InvoiceChain — Level 6 (Black Belt) Submission

Stellar/Soroban üzerinde bir **fatura faktoring pazarı**: işletmeler ödenmemiş
faturaları tokenize edip iskontoyla satar, yatırımcılar getiri için alır, borçlu
ödeyince yatırımcı tam tutarı toplar — **gasless onboarding** ile.

- **Repo:** https://github.com/BurcuMengu/invoicechain-mainnet
- **Canlı demo (testnet):** https://burcumengu.github.io/invoicechain
- **Kullanıcı kılavuzu:** [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md)
- **Güvenlik denetimi:** [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md)
- **Mainnet deploy runbook:** [`DEPLOY.md`](DEPLOY.md)

> **Durum:** Kod, güvenlik, dokümantasyon ve pazarlama materyalleri **hazır**.
> Mainnet-canlı maddeleri (R3–R7) `DEPLOY.md` ile "deploy-hazır" beklemededir;
> tamamlanınca aşağıdaki `[bekliyor]` linkleri doldurulacaktır.

## Gereksinim izlenebilirlik matrisi

| # | Gereksinim | Durum | Kanıt |
|---|---|---|---|
| R1 | Public GitHub repo | ✅ | [repo](https://github.com/BurcuMengu/invoicechain-mainnet) |
| R2 | 30+ meaningful commit | ✅ | **87 commit** (`git rev-list --count HEAD`) |
| R3 | Kontratlar mainnet'te deploy | ⏳ deploy-hazır | `scripts/deploy_mainnet.sh`, `DEPLOY.md §1` |
| R4 | Mainnet kontrat adresleri | ⏳ | deploy sonrası `deployments/mainnet.json` |
| R5 | Canlı mainnet app | ⏳ deploy-hazır | env-driven `frontend/src/lib/config.ts`, `DEPLOY.md §2` |
| R6 | 20+ verified mainnet kullanıcı | ⏳ | onboarding formu hazır (R15); mainnet sonrası |
| R7 | Gerçek on-chain tx aktivitesi | ⏳ | mainnet sonrası (explorer linkleri) |
| R8 | Smart contract audit / security review | ✅ | [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md) — 10 bulgu, 7 fixed / 3 acknowledged, 0 açık |
| R9 | Twitter/X launch post | ✅ taslak → yayın | [`docs/marketing/twitter-launch-thread.md`](docs/marketing/twitter-launch-thread.md) |
| R10 | Demo/showcase video | ✅ senaryo → çekim | [`docs/marketing/demo-video-script.md`](docs/marketing/demo-video-script.md) |
| R11 | Ekosistem katkısı (blog/tutorial) | ✅ yazıldı → publish | [`docs/marketing/blog-invoice-factoring-gasless.md`](docs/marketing/blog-invoice-factoring-gasless.md) |
| R12 | Advanced feature → **Fee Sponsorship (gasless)** | ✅ | `frontend/src/lib/feeSponsor.ts`, `sponsor-worker/`, [spec](docs/superpowers/specs/2026-07-16-fee-sponsorship-design.md) |
| R13 | Full technical documentation | ✅ | `README.md`, spec'ler, `DEPLOY.md`, `sponsor-worker/README.md` |
| R14 | User guide/documentation | ✅ | [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md) |
| R15 | Onboarding: Google Form (wallet/email/isim/rating) | ✅ | README "User onboarding" bölümü |
| R16 | Yanıtlar → Excel + README linki | ✅ | `docs/user-responses.xlsx` (testnet) → mainnet için güncellenecek |
| R17 | README'de feedback-tabanlı iyileştirme + commit linkleri | ✅ | README "How feedback drives the next iteration" |

## Öne çıkanlar

### Güvenlik (R8)
Mainnet öncesi **çok-ajanlı adversaryal denetim** (6 finder → dedup → skeptik
doğrulama): 20 ham → 10 benzersiz bulgu, **10/10 CONFIRMED, 0 yanlış-pozitif**.
Fon-çalma / reentrancy / auth-atlatma **yok**. Objektif bulgular TDD ile düzeltildi
(itibar-şişirme IC-02, DoS IC-03, aritmetik IC-04/IC-10, TTL IC-07, upgrade/pause
IC-08, deploy IC-09; test_token IC-01). Kontrat testleri 31+3+4 yeşil, `clippy` temiz.

### Advanced feature — Fee Sponsorship / gasless onboarding (R12)
Yeni kullanıcının ilk marketplace işlemlerinin (create/buy/settle + approve) ağ
ücreti **Launchtube** fee-bump ile sponsorlanır. Sponsor token'ı gizli tutan +
allowlist ve rate-limit uygulayan minimal bir **Cloudflare Worker** proxy; her yerde
env-gated ve başarısızlıkta güvenli fallback. Testler: worker 9/9, frontend 28/28.

### Mimari (R13)
3 Soroban kontratı (`marketplace` / `reputation` / SEP-41 `token`) + React (Vite/TS)
+ Stellar Wallets Kit. Cross-contract itibar gating, CEI düzeni, env-driven mainnet
config.

## Mainnet'i tamamlamak için (R3–R7)
Tümü `DEPLOY.md`'de adım adım. Yaklaşık maliyet: birkaç XLM (deploy) + minik,
büyük ölçüde geri-alınabilir bir USDC float'ı (gasless kullanıcı ücretini üstlenir).

1. **R3/R4:** `DEPLOY.md §1` — multisig admin + `deploy_mainnet.sh` → `mainnet.json`.
2. **R5:** `DEPLOY.md §2` — frontend env'ini mainnet id'lerine ayarla + deploy.
3. **R6/R7:** canlı app + onboarding formuyla 20+ gerçek kullanıcı + tx kanıtı topla.

## Yayın adımları (R9–R11, ücretsiz)
- **R9:** `twitter-launch-thread.md`'yi Stellar etiketleriyle postla → linki buraya ekle.
- **R10:** `demo-video-script.md` ile videoyu çek/yükle → linki ekle.
- **R11:** `blog-invoice-factoring-gasless.md`'yi dev.to/Medium/Discord'da yayınla → linki ekle.

---

*Bu belge submission'ın canlı checklist'idir; `⏳` maddeler tamamlandıkça linkler doldurulacaktır.*
