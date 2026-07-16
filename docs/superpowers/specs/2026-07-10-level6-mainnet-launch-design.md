# InvoiceChain — Level 6: Mainnet Launch (Master Spec / Roadmap)

- **Tarih:** 2026-07-10
- **Kapsam commit:** `475c411`
- **Repo:** `BurcuMengu/invoicechain-mainnet` (public)
- **Amaç:** InvoiceChain'i Stellar **mainnet**'e çıkarıp Level 6 (Black Belt) tüm
  zorunlu maddelerini karşılamak: mainnet deploy + production app + gerçek
  adaptasyon + güvenlik + pazarlama + ekosistem katkısı + advanced feature.

> Bu bir **master spec**'tir: Level 6'yı iş kollarına (workstream) ayırır, her
> gereksinimi durum + sahip + iş koluyla izler. Kod gerektiren her iş kolu kendi
> detaylı spec/plan'ına sahiptir (örn. Güvenlik → [security-audit spec](2026-07-10-security-audit-design.md)).

## 1. Sahiplik ilkesi (kim yapar)

Level 6 maddeleri iki gruba ayrılır:

- **[C] Claude-buildable** — kod/doküman/taslak olarak ben üretirim (audit,
  mainnet deploy scriptleri, USDC SAC geçişi, fee sponsorship, docs, launch/blog
  taslakları, onboarding yapısı).
- **[U] User-action** — yalnızca sen yapabilirsin (gerçek XLM ile deploy'u
  çalıştırmak, 20+ gerçek kullanıcı bulmak, Twitter/X'e post atmak, demo videoyu
  çekip yüklemek, blog/workshop'u yayınlamak, mentör onayı almak).
- **[C→U]** — ben hazırlarım, sen çalıştırır/yayınlarsın.

## 2. Gereksinim izlenebilirlik matrisi

| # | Level 6 gereksinimi | Şu anki durum | Sahip | İş kolu |
|---|---|---|---|---|
| R1 | Public GitHub repo | ✅ Var | — | — |
| R2 | 30+ meaningful commit | ✅ 67 commit | — | — |
| R3 | Kontratlar mainnet'te deploy | ❌ Testnet only | [C→U] | WS1 |
| R4 | Mainnet kontrat adresleri | ❌ | [C→U] | WS1 |
| R5 | Public production app canlı | ❌ Testnet | [C→U] | WS2 |
| R6 | 20+ verified mainnet kullanıcı | ❌ 3 testnet formu | [C→U] | WS4 |
| R7 | Gerçek on-chain tx aktivitesi | ❌ | [U] | WS4 |
| R8 | Smart contract audit **VEYA** mentör security review | ⏳ Audit kuruluyor | [C] | WS0 |
| R9 | Twitter/X launch post/thread | ❌ | [C→U] | WS6 |
| R10 | Demo/showcase içeriği (video) | ⚠️ Demo GIF var, video yok | [C→U] | WS6 |
| R11 | Ekosistem katkısı (blog/workshop/tutorial/OSS/community — ≥1) | ❌ | [C→U] | WS6 |
| R12 | Advanced feature (≥1) → **Fee Sponsorship (gasless)** | ❌ | [C] | WS3 |
| R13 | Full documentation & production setup | ⚠️ README var, mainnet/prod eksik | [C] | WS5 |
| R14 | User guide/documentation | ⚠️ Kısmi | [C] | WS5 |
| R15 | Onboarding: Google Form (wallet/email/isim/rating) | ✅ Var | — | WS4 |
| R16 | Yanıtları Excel'e export + README linki | ✅ Var (testnet) → mainnet için güncellenecek | [C→U] | WS4 |
| R17 | README'de feedback-tabanlı iyileştirme + commit linkleri | ✅ Var → mainnet fazı için güncellenecek | [C] | WS4 |

## 3. Advanced feature kararı — Fee Sponsorship (gasless)

Seçim: **Fee Sponsorship** (fee-bump ile gasless işlemler). Gerekçe: 20+ mainnet
kullanıcı (R6) hedefini doğrudan destekler — yeni kullanıcı işlem yapmak için
XLM tutmak zorunda kalmaz, onboarding sürtünmesi düşer. Kod olarak en tractable
seçenek ve son-kullanıcı UX'ine en yüksek getiri.

**Yaklaşım (özet, detayı WS3 spec'inde):** Kullanıcı işlemini bir **sponsor
hesabı** fee-bump transaction ile sarmalar; ağ ücretini sponsor öder, kullanıcı
imzası korunur. İki olası uygulama katmanı:
- İstemci tarafı: uygulama, imzalı iç işlemi sponsor servisine gönderir; servis
  fee-bump'lar ve ağa iletir (Launchtube benzeri bir akış ya da kendi sponsor
  endpoint'imiz).
- Sponsor anahtar yönetimi ve kötüye kullanım limitleri (rate-limit, işlem tipi
  allowlist) WS3 spec'inde ele alınır.

## 4. İş kolları (workstream) ve sıralama

Sıralama kritik: **audit → mainnet deploy → advanced feature → canlı app →
gerçek kullanıcı/aktivite → pazarlama/ekosistem → submission**. Gerçek para ve
gerçek kullanıcı öncesinde güvenlik ve deploy tamam olmalı.

### WS0 — Güvenlik audit'i  `[C]`  (R8)
Çok-ajanlı adversaryal audit + severity raporu + düzeltme + test.
**Detaylı spec:** [`2026-07-10-security-audit-design.md`](2026-07-10-security-audit-design.md).
Çıktı: `SECURITY-AUDIT.md`, tüm Critical/High Fixed, `cargo test` yeşil.
Bu, mainnet deploy'un ön koşulu ve R8'i (audit yolu) karşılar.

### WS1 — Mainnet contract deployment  `[C→U]`  (R3, R4)
- `test_token` yerine **gerçek USDC SAC** (Stellar Asset Contract) adresini
  kullanacak şekilde marketplace config'i (deploy-time `token` argümanı).
- `deploy_mainnet.sh` scripti: pubnet passphrase, gerçek RPC, USDC SAC id,
  admin/multisig kararı (bkz. audit DD-2), sonuçları `deployments/mainnet.json`.
- Faucet akışı mainnet'te devre dışı (gerçek USDC alınır, mint edilmez).
- **[U]:** gerçek XLM ile fonlanmış deployer anahtarıyla scripti çalıştırmak.
- Çıktı: `deployments/mainnet.json` + README'de mainnet adresleri.

### WS2 — Production-ready frontend  `[C→U]`  (R5)
- Frontend network config'i mainnet'e (pubnet passphrase, mainnet RPC/Horizon,
  mainnet kontrat id'leri) alacak env-tabanlı yapı; testnet fallback korunur.
- Testnet faucet UI'ı mainnet'te gizlenir; gerçek USDC bakiye/trustline akışı.
- Production build + hosting (mevcut GitHub Pages ya da uygun host), monitoring
  (PostHog/Sentry) mainnet ortamına bağlanır.
- **[U]:** production secret'ları (WalletConnect id, PostHog key) ve deploy tetiği.

### WS3 — Advanced feature: Fee Sponsorship  `[C]`  (R12)
Kendi detaylı spec'i olacak. Gasless işlem akışı, sponsor servis/endpoint,
kötüye kullanım korumaları, frontend entegrasyonu, testler.

### WS4 — Gerçek adaptasyon & onboarding  `[C→U]`  (R6, R7, R15–R17)
- Mevcut Google Form + Excel + README iyileştirme yapısı **mainnet'e uyarlanır**
  (wallet adresleri mainnet, rating, feedback).
- README'de yeni "mainnet feedback → sonraki faz iyileştirmeleri" bölümü, her
  iyileştirmeye **git commit linki** (R17 zorunlu).
- 20+ **mainnet** kullanıcı ve gerçek on-chain tx (R6/R7) — **[U]** kullanıcıları
  getirir; ben tx aktivite kanıtını (explorer linkleri, event dökümü) toplamak
  için yardımcı script/döküman hazırlarım.
- Çıktı: güncel `docs/user-responses.xlsx` (mainnet), README onboarding bölümü,
  tx aktivite kanıt sayfası.

### WS5 — Dokümantasyon & production setup  `[C]`  (R13, R14)
- README: mainnet bölümü, mainnet adresleri, production setup (env, deploy,
  monitoring, sponsor servisi).
- Ayrı **user guide** (adım adım: cüzdan, USDC trustline, invoice create/buy/settle).
- `SECURITY-AUDIT.md` linki, mimari/limitler.

### WS6 — Pazarlama & ekosistem katkısı  `[C→U]`  (R9, R10, R11)
- **[C]** Twitter/X launch thread taslağı (Stellar ekosistem etiketleriyle),
  demo video senaryosu/çekim listesi, ve ekosistem katkısı için bir **teknik
  blog/tutorial taslağı** (örn. "Soroban'da invoice factoring + gasless UX").
- **[U]** Post'u atmak, videoyu çekip yüklemek, blog/tutorial'ı yayınlamak.
- Çıktı: Twitter linki, demo video linki, blog/tutorial linki (submission için).

### WS7 — Submission assembly  `[C→U]`
Submission checklist'inin tüm kanıtlarını tek bir `SUBMISSION.md`'de toplamak
(repo linki, commit sayısı, mainnet app linki, mainnet adresleri, 20+ kullanıcı
kanıtı, tx aktivite kanıtı, audit kanıtı, Twitter linki, demo video, docs, user
guide, ekosistem katkı linki).

## 5. Bağımlılık grafiği

```
WS0 (audit) ──► WS1 (mainnet deploy) ──► WS2 (prod app) ──┐
                       │                                  │
                       └──► WS3 (fee sponsorship) ────────┤
                                                          ▼
                                        [U] app canlı ──► WS4 (20+ user + tx)
                                                          │
                                          WS5 (docs) ◄────┤
                                                          ▼
                                        WS6 (marketing/ekosistem) ──► WS7 (submission)
```

## 6. Çıkış kriterleri = Submission Checklist

Level 6 "tamam" sayılır ancak şunların **hepsi** sağlandığında:

- [ ] Public GitHub repo (R1) ✅
- [ ] 30+ meaningful commit (R2) ✅ (67)
- [ ] Live mainnet application (R5)
- [ ] Mainnet contract addresses (R3/R4)
- [ ] 20+ mainnet kullanıcı kanıtı (R6)
- [ ] Transaction activity kanıtı (R7)
- [ ] Audit/security review kanıtı (R8) — `SECURITY-AUDIT.md`
- [ ] Twitter/X launch post linki (R9)
- [ ] Demo video linki (R10)
- [ ] Advanced feature: Fee Sponsorship (R12)
- [ ] Technical documentation (R13)
- [ ] User guide/documentation (R14)
- [ ] Community/ecosystem contribution linki (R11)
- [ ] Onboarding form + Excel + README iyileştirme (commit linkli) (R15–R17)

## 7. Şimdi ne yapıyoruz

Sıralamaya göre **WS0 (güvenlik audit'i)** ile başlıyoruz — detayı ayrı spec'te
onaylandı. WS0 bittikten sonra WS1 (mainnet deploy) ve WS3 (fee sponsorship)
kendi spec/plan'larıyla açılır. Bu master spec, tüm iş kollarının durumunu
tek yerden izler.
