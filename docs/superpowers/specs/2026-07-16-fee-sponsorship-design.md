# InvoiceChain — WS3: Fee Sponsorship (Gasless Onboarding) — Tasarım / Spec

- **Tarih:** 2026-07-16
- **Repo:** `BurcuMengu/invoicechain-mainnet`
- **Level 6 iş kolu:** WS3 — Advanced feature (R12)
- **Master spec:** [`2026-07-10-level6-mainnet-launch-design.md`](2026-07-10-level6-mainnet-launch-design.md)
- **Önceki iş kolu:** WS0 (audit) ✅, WS1 (mainnet deploy scripti) ✅

## 1. Amaç

Yeni bir kullanıcının **hiç XLM tutmadan** ilk marketplace işlemlerini yapabilmesini
sağlamak (gasless onboarding). Bu, Level 6'nın en zorlu maddesi olan **R6 (20+ gerçek
mainnet kullanıcısı)** için asıl sürtünmeyi — "işlem yapmadan önce XLM edinmen gerekir"
duvarını — kaldırır. Aynı zamanda gerekli **advanced feature (R12)** kanıtıdır.

## 2. Kapsam

**Kapsam içi:**
- Bağlı bir cüzdanın (Stellar Wallets Kit) **ilk N marketplace işleminin** (`create_invoice`,
  `buy_invoice`, `settle`) **işlem ücretinin** bir sponsor tarafından **fee-bump** ile
  ödenmesi. Kullanıcı işlemini imzalar; ağ ücretini sponsor öder.
- Sponsorlama **Launchtube** (Stellar hosted submit/fee-bump servisi) üzerinden yapılır.
- Sponsor kimlik bilgisini (Launchtube token) gizli tutan ve kullanıcı-başına limit
  uygulayan **minimal bir Cloudflare Worker proxy**.
- Sponsorlama uygun değilse (özellik kapalı, limit dolu, hata) **şeffaf fallback**:
  mevcut "cüzdan ücreti öder" yolu.

**Kapsam dışı:**
- **Hesap oluşturma / min. reserve fonlaması.** Kullanıcının bağladığı cüzdanın zaten
  var olan bir Stellar hesabı (G-adresi) olduğu varsayılır. Gasless burada "**ücret için
  XLM tutmana gerek yok**" demektir, "hesabın olmasına gerek yok" değil.
- Passkey / smart-wallet (contract account) entegrasyonu.
- Marketplace dışı işlemlerin sponsorlanması.

## 3. Mimari

Üç bileşen; her biri tek sorumluluk, iyi tanımlı arayüz, bağımsız test edilebilir.

```
[Frontend]  build+sign invoke tx
     │  signed XDR (POST)
     ▼
[Cloudflare Worker proxy]  ── token gizli, allowlist + rate-limit ──►  [Launchtube]  ──►  Stellar ağı
     │  (limit/allowlist reddi → 4xx)                                      fee-bump + submit
     ▼
[Frontend]  başarı → tx result;  reddi/hata → normal cüzdan-öder yoluna fallback
```

### 3.1 Frontend istemci modülü — `frontend/src/lib/feeSponsor.ts`
Tek genel fonksiyon, örn:
```ts
// enabled = !!import.meta.env.VITE_SPONSOR_URL
submitSponsored(signedXdr: string): Promise<{ hash: string } | SponsorUnavailable>
```
- `VITE_SPONSOR_URL` yoksa → `SponsorUnavailable` döner (çağıran normal yola düşer).
- Worker'a imzalı XDR'ı POST eder; 2xx → tx hash; 429/403/5xx → `SponsorUnavailable`.
- **Güvenlik/erişim mantığı istemcide tutulmaz** (bypass edilebilir); istemci yalnızca
  "dene, olmazsa düş" yapar. Gerçek kapı Worker'dadır.

### 3.2 Cloudflare Worker proxy — `sponsor-worker/` (yeni, ayrı paket)
Tek `src/index.ts`. Sorumluluğu:
1. **Parse & doğrula:** Gelen imzalı XDR'ı `@stellar/stellar-sdk` ile çöz. Tek bir
   `InvokeHostFunction` op'u olmalı; çağrılan kontrat **`MARKETPLACE_ID`** ve fonksiyon
   **allowlist**'te (`create_invoice`/`buy_invoice`/`settle`) olmalı; değilse `403`.
2. **Rate-limit:** İşlem kaynağı hesap (kullanıcı G-adresi) ve istek IP'si üzerinden
   Cloudflare **KV** sayaçları:
   - adres başına ömür-boyu **N (varsayılan 3)** sponsorlu işlem,
   - IP başına **günlük** tavan (KV TTL 24s).
   - Aşılırsa `429`.
3. **İlet:** Doğrulanmış XDR'ı gizli `LAUNCHTUBE_TOKEN` ile `LAUNCHTUBE_URL`'e POST eder;
   Launchtube fee-bump + submit yapar. Sonucu istemciye döner.
- **Secret'lar** (Worker env, asla frontend'de değil): `LAUNCHTUBE_URL`, `LAUNCHTUBE_TOKEN`,
  `MARKETPLACE_ID`, `PER_ADDRESS_LIMIT`, `PER_IP_DAILY_LIMIT`.

### 3.3 Frontend entegrasyonu
Mevcut kontrat-invoke yolunda (`frontend/src/lib/` / ilgili hook) imza sonrası:
`submitSponsored(xdr)` denenir; `SponsorUnavailable` dönerse mevcut `rpc.sendTransaction`
yoluna düşülür. Kullanıcıya uygun durumda **"⚡ Gasless"** rozeti; fallback'te sessizce
normal akış. Tümü `VITE_SPONSOR_URL` ile env-gated — özellik açılıp kapatılabilir,
mevcut davranışı bozmaz.

## 4. Abuse / güvenlik modeli

| Katman | Koruma |
|---|---|
| Token gizliliği | Launchtube token yalnızca Worker env'inde; frontend'de asla. |
| Allowlist | Yalnızca `MARKETPLACE_ID` + `create/buy/settle`; başka kontrat/fonksiyon reddedilir. |
| Per-user limit | KV: adres başına ömür-boyu N; IP başına günlük tavan. |
| Global bound | Launchtube token quota'sı (üst sınır; tükenirse fallback). |
| Fail-safe | Worker/limit/hata → istemci normal cüzdan-öder yoluna düşer; işlem yine tamamlanır. |

**Kalan risk (dokümante):** KV eventual-consistency nedeniyle per-adres limiti "yumuşak"
hard değil (yarış durumunda birkaç fazla). Kabul edilebilir; asıl global tavan Launchtube
quota'sıdır. Sybil (çok adres) tam çözülemez — IP tavanı + küçük N ile sınırlandırılır.

## 5. Konfigürasyon

- **Frontend:** `VITE_SPONSOR_URL` (Worker URL). Yoksa özellik kapalı, mevcut akış aynen.
- **Worker (secrets):** `LAUNCHTUBE_URL`, `LAUNCHTUBE_TOKEN`, `MARKETPLACE_ID`,
  `PER_ADDRESS_LIMIT=3`, `PER_IP_DAILY_LIMIT`. `wrangler.toml` + KV namespace binding.
- **[U] kullanıcı adımları:** Launchtube token'ı edin, Cloudflare hesabı + `wrangler deploy`,
  secret'ları set et, `VITE_SPONSOR_URL`'i frontend env'ine ekle.

## 6. Test

- **`feeSponsor.ts`** (vitest + jsdom): (a) `VITE_SPONSOR_URL` yokken `SponsorUnavailable`;
  (b) 2xx'te hash döner; (c) 429/403/5xx'te fallback sinyali; (d) fetch hatasında fallback.
  (Worker `fetch` mock'lanır.)
- **Worker** (vitest + Miniflare/`unstable_dev`): (a) marketplace-dışı kontrat → 403;
  (b) allowlist-dışı fonksiyon → 403; (c) limit altında ilet (Launchtube mock) → 2xx;
  (d) N aşımı → 429; (e) IP günlük tavan → 429.

## 7. Doğrulama & Çıkış Kriterleri

- [ ] `feeSponsor.ts` + Worker implemente, tüm birim testleri yeşil.
- [ ] Özellik `VITE_SPONSOR_URL` ile env-gated; kapalıyken mevcut frontend testleri aynen geçer.
- [ ] Allowlist + rate-limit Worker'da uygulanıyor ve test ediliyor.
- [ ] Uçtan uca **gerçek bir gasless invoke** testnet'te çalışıyor (mainnet'e hazır).
- [ ] README/user-guide'da gasless akışı ve `[U]` kurulum adımları belgeleniyor (WS5).

## 8. Sonraki adımlarla ilişki

WS3 çıktısı R12'yi (advanced feature) karşılar ve R6'yı (20+ kullanıcı) doğrudan
destekler. Frontend'in mainnet'e alınması **WS2**'de, kurulum dokümantasyonu **WS5**'te
tamamlanır. `create_invoice`'ın artık `debtor: Address` alması (audit IC-02) frontend
form değişikliğini de gerektirir (WS2) — sponsorlu `create` akışı bunu içermeli.
