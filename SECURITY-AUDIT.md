# InvoiceChain — Mainnet-Öncesi Güvenlik Audit Raporu

- **Proje:** InvoiceChain — Stellar Soroban invoice-factoring marketplace
- **Repo:** `BurcuMengu/invoicechain-mainnet`
- **Denetlenen kontratlar:** `marketplace`, `reputation`, `test_token`
- **Baz commit (audit kapsamı):** `2de2fc4`
- **Tarih:** 2026-07
- **Metodoloji:** Çok-ajanlı adversaryal audit (6 saldırı-vektörü finder → dedup/severity → her bulgu için bağımsız skeptik doğrulama). Yalnızca CONFIRMED bulgular rapora alındı.
- **Tasarım spec:** [`docs/superpowers/specs/2026-07-10-security-audit-design.md`](docs/superpowers/specs/2026-07-10-security-audit-design.md)

> **Amaç:** InvoiceChain gerçek USDC ile Stellar mainnet'e (pubnet) çıkmadan önce
> tüm bilinen zafiyet sınıflarını tespit etmek, objektif kusurları regresyon
> testleriyle düzeltmek ve tasarım/risk kararlarını belgelemek.

---

## 1. Özet

Çok-ajanlı denetim **20 ham bulgu** üretti; birleştirme/dedup sonrası **10 benzersiz
bulgu** kaldı ve her biri bağımsız bir skeptik ajan tarafından koda karşı doğrulandı
(**10/10 CONFIRMED, 0 yanlış-pozitif**).

**Kritik sonuç:** Doğrudan fon çalma, yetkisiz state mutasyonu veya reentrancy
**bulunmadı**. Çekirdek değer-transfer akışı (create → buy → settle → default/cancel)
CEI (checks-effects-interactions) düzenine doğru uyuyor ve tüm `require_auth`
kapıları yerinde. Bulgular üç kategoride toplandı: **deploy hijyeni**, **girdi
doğrulama / aritmetik güvenlik**, ve **tasarım/yönetişim tercihleri**.

Tüm objektif kusurlar düzeltildi; düzeltmeler **37 birim testiyle** (30 marketplace +
3 reputation + 4 test_token) sabitlendi. `cargo test` ve `cargo clippy` temiz.

## 2. Severity Özet Tablosu

| Severity | Adet | Fixed | Acknowledged | Deploy'a devredildi |
|---|---|---|---|---|
| Critical | 1 | — | 1 (IC-01) | 1 (IC-01) |
| High | 2 | 2 (IC-02, IC-03) | — | — |
| Medium | 5 | 2 (IC-04, IC-08) | 2 (IC-05, IC-06) | 1 (IC-09) |
| Low | 2 | 2 (IC-07, IC-10) | — | — |
| **Toplam** | **10** | **6** | **3** | **1** |

> Not: IC-01 hem "Acknowledged" (mainnet'te test_token deploy edilmez, gerçek USDC SAC
> kullanılır) hem de kod tarafında savunma ekiyle (init guard + testnet-only uyarısı)
> ele alındı. IC-08'in multisig boyutu operasyoneldir (bkz. DD-2).

## 3. Bulgular

### IC-01 — `test_token.faucet()` yetkisiz/sınırsız mint + 'USDC' kimlik taklidi
- **Severity:** Critical · **Durum:** ✅ Mitige + Acknowledged (deploy)
- **Konum:** `contracts/test_token/src/lib.rs:81` (faucet), `:75` (`__constructor`)
- **Açıklama:** `faucet(to)` hiçbir `require_auth`, admin gate veya üst sınır olmadan
  herkese, sınırsız kez token basar. `__constructor` re-init guard'ı yoktu ve mock,
  gerçek USDC ile görsel olarak ayırt edilemeyecek `name="USD Coin"/symbol="USDC"` ile
  deploy ediliyor.
- **Exploit:** Saldırgan `faucet(kendi)` döngüsüyle sınırsız "USDC" basar, marketplace'e
  approve verip değersiz token'la `buy/settle` yürüterek güvenen karşı taraftan değer
  çeker. test_token mainnet'e ulaşırsa tüm USDC-değer varsayımı çöker.
- **Düzeltme:**
  1. **Deploy (birincil):** Mainnet'te test_token **deploy edilmez**; marketplace
     `__constructor`'a **kanonik USDC Stellar Asset Contract (SAC)** adresi verilir.
     Marketplace token'ı zaten storage'dan okuduğu için marketplace kodu değişmez.
     (WS1 — mainnet deploy).
  2. **Savunma (kod):** `__constructor`'a `AlreadyInitialized` guard'ı eklendi ve
     dosyaya "TESTNET ONLY — mainnet'e deploy etmeyin" uyarısı yazıldı.
  - **Test:** `test_token::constructor_rejects_reinitialization`.

### IC-02 — `settle` reputation'ı ödeyenden bağımsız seller'a yazıyor (itibar şişirme)
- **Severity:** High · **Durum:** ✅ Fixed
- **Konum:** `contracts/marketplace/src/lib.rs` (settle), `contracts/reputation/src/lib.rs` (record_settled)
- **Açıklama:** `Invoice` yalnızca `debtor_name: String` (etiket) tutuyordu; on-chain
  borçlu adresi yoktu. `settle` sadece `payer.require_auth()` çağırıp reputation'ı
  koşulsuz `seller`'a yazıyordu. Satıcı; seller/investor/payer adreslerini kontrol
  ederek net-sıfır maliyetle sahte `settled_count`/`volume` üretebiliyordu.
- **Exploit:** Satıcı A ve B adreslerini kontrol eder; A fatura çıkarır, B alır, B
  öder (para A↔B döner, sadece ücret). Her tur A'nın itibarını artırır → 1000 turda
  sahte "1000 başarılı işlem". Gerçek yatırımcılar bu sahte puana güvenip dolandırılır.
- **Karar:** Kullanıcı → **borçluyu on-chain adrese bağla** (IC-02 seçenek 1).
- **Düzeltme:** `Invoice`'a `debtor: Address` alanı eklendi; `create_invoice` bunu
  alır; `settle`'da `payer == inv.debtor` doğrulanır (aksi halde `NotDebtor`). Artık
  reputation "borçlu gerçekten ödedi" anlamına gelir.
  - **Test:** `settle_rejects_non_debtor_payer` (+ `settle_pays_owner_face_value`,
    `settle_records_reputation` güncellendi).

### IC-03 — `list_*` sınırsız `0..NextId` taraması + sınırsız `debtor_name` → DoS brick
- **Severity:** High · **Durum:** ✅ Fixed (+ off-chain indexing önerisi)
- **Konum:** `contracts/marketplace/src/lib.rs` (filter, list_*)
- **Açıklama:** `filter()` her `list_*` çağrısında `0..NextId` aralığını tarayıp her
  fatura için ayrı persistent read yapıyordu. `NextId` monoton artıyor ve `debtor_name`
  uzunluğu sınırsızdı; yeterli fatura (veya birkaç şişkin isim) per-tx read limitini
  aşınca `list_*` kalıcı olarak `ResourceLimitExceeded` ile bozuluyordu.
- **Exploit:** Saldırgan yalnızca tx ücretiyle çok sayıda (veya çok-kilobaytlık isimli)
  fatura yaratır; order-book listeleme uçları kalıcı olarak bozulur.
- **Düzeltme:**
  - `debtor_name.len() > 64` → `NameTooLong` ile reddedilir (per-entry maliyet sınırı).
  - `filter()` yalnızca **son `MAX_LIST_SCAN=1000`** id'yi tarar (`saturating_sub`),
    böylece büyüyen `NextId` listeyi kilitleyemez ("best-effort").
  - Tam/sayfalı geçmiş için **off-chain event indexer** standart yol olarak
    dokümante edilir (DD-5). `get_invoice` ile tek fatura her zaman okunabilir.
  - **Test:** `create_invoice_rejects_oversized_debtor_name`.

### IC-04 — `due_ledger + GRACE` u64 taşması `mark_default`'ı kalıcı paniklatır
- **Severity:** Medium (finder: High) · **Durum:** ✅ Fixed
- **Konum:** `contracts/marketplace/src/lib.rs` (create_invoice due kontrolü, mark_default)
- **Açıklama:** `due_ledger` yalnızca "gelecekte" diye doğrulanıyor, üst sınırı yoktu.
  `overflow-checks=true` altında `inv.due_ledger + GRACE_PERIOD_LEDGERS` taşarsa panik.
  Satıcı `due_ledger ≈ u64::MAX` ile `mark_default`'ı o fatura için kalıcı çağrılamaz
  yapıp kendi temerrüdünün reputation'a yazılmasını engelleyebilir (liveness/griefing).
- **Düzeltme:** `create_invoice` `due_ledger <= sequence + MAX_INVOICE_HORIZON` (~1 yıl)
  sınırı koyar (`DueTooFar`); `mark_default` `saturating_add` kullanır.
  - **Test:** `create_invoice_rejects_due_too_far`.

### IC-05 — Admin `set_reputation` ile reputation'ı kötü kontratla değiştirebilir
- **Severity:** Medium (finder: High) · **Durum:** 🟨 Acknowledged
- **Konum:** `contracts/marketplace/src/lib.rs` (set_reputation, cross-contract çağrılar)
- **Açıklama:** `set_reputation` yalnızca `admin.require_auth()` ister. Ele geçirilmiş/
  kötü niyetli admin, her `settle`/`mark_default`'ın çağırdığı reputation adresini
  saldırgan kontratla değiştirebilir. **Doğrulama notu:** Bu **fon çalma değildir**
  (token transferi marketplace-spender + kullanıcı auth ile korunur, CEI doğru) —
  etki reputation-veri bütünlüğü ve settle/default **erişilebilirliği** (kötü kontrat
  paniklerse DoS) ile sınırlı; ayrıcalıklı-admin/merkezileşme riski.
- **Karar (Acknowledged):** Admin yetkisi dar tutuldu. Azaltım: mainnet'te admin
  **multisig/donanım cüzdanı** olacak (DD-2). Kalıcı kapatma seçeneği reputation'ı
  immutable yapmaktır (constructor-only) — bu deploy döngüsünün yeniden tasarımını
  gerektirir ve IC-09 ile birlikte WS1'de değerlendirilecek.

### IC-06 — Escrow yok: `buy` anında seller'a ödeme, default kozmetik
- **Severity:** Medium · **Durum:** 🟨 Acknowledged (iş modeli kararı)
- **Konum:** `contracts/marketplace/src/lib.rs` (buy_invoice, mark_default)
- **Açıklama:** `buy_invoice` iskontolu tutarı anında seller'a gönderir; kontrat escrow
  tutmaz. Borçlu ödemezse `mark_default` yalnızca reputation'a eksi yazar; clawback yok,
  yani tüm karşı-taraf riski yatırımcıda. Reputation adres-bazlı olduğundan temerrüde
  düşen satıcı yeni adresle sıfırdan başlayabilir. **Bu bir kod hatası değildir** — tüm
  auth/state-machine kapıları doğru; bu, anında-avans faktoring modelinin doğasıdır.
- **Karar (Acknowledged):** Kullanıcı → **anında avans modeli korunur** (IC-06 seçenek 1);
  gerçek faktoringde de faktör peşin avans verip riski üstlenir. Güçlendirme: dayanıklı/
  sıfırlanamayan reputation + (mainnet sonrası) KYC/whitelist katmanı önerilir.

### IC-07 — Instance/Score TTL yalnızca write'ta bump → atalette arşivlenip sıfırlanır
- **Severity:** Low (finder: Medium) · **Durum:** ✅ Fixed
- **Konum:** `contracts/marketplace/src/lib.rs` (read yolları), `contracts/reputation/src/lib.rs` (get_score)
- **Açıklama:** Marketplace instance entry'si ve reputation `Score` yalnızca yazma
  yollarında TTL bump ediliyordu. ~30 gün salt-okuma/atalet sonrası entry arşivlenir;
  reputation tarafında `read_score` "arşivlenmiş"i "hiç yok" ile karıştırıp sıfır
  Score döndürür → sonraki yazma iyi bir aktörün geçmişini siler (veri kaybı).
- **Düzeltme:** `get_invoice`/`list_*` artık instance TTL bump eder; `get_score` okuma
  yolunda `Score` TTL'sini bump eder. (Kalan risk: uzun tam-atalet; mainnet için restore
  runbook + daha uzun TTL önerilir.)

### IC-08 — Tek hot-key admin, upgrade yok, pause yok
- **Severity:** Medium · **Durum:** ✅ Fixed (kod) + 🟨 Acknowledged (multisig=ops)
- **Konum:** Tüm kontratlar (governance yüzeyi)
- **Açıklama:** Kontratlarda upgrade giriş noktası, pause/circuit-breaker ve admin
  rotasyonu/multisig yoktu; bir bug bulunsa yerinde yamalanamaz, süren bir istismar
  on-chain durdurulamaz.
- **Karar:** DD-1 (upgrade) + DD-3 (pause) **eklendi**; DD-2 (multisig) operasyonel.
- **Düzeltme:**
  - **`upgrade(new_wasm_hash)`** — admin-gated, `update_current_contract_wasm` (DD-1).
  - **`set_paused(bool)` + `is_paused()`** — admin-gated circuit breaker. **Yalnızca**
    `create_invoice`/`buy_invoice` bloke edilir; `settle`/`mark_default`/`cancel` her
    zaman açık kalır → hiçbir funded invoice kilitlenemez (DD-3).
  - **Multisig (DD-2):** Mainnet'te admin, deployer hot-key yerine **multisig/donanım
    cüzdanı** olacak (deploy-zamanı/operasyonel; kontrat `admin.require_auth()` bunu
    otomatik uygular).
  - **Test:** `upgrade_rejects_non_admin`, `set_paused_rejects_non_admin`,
    `paused_blocks_buy_invoice`, `paused_blocks_create_and_buy_but_allows_settle`.

### IC-09 — Deploy `reputation=token` placeholder + manuel `set_reputation` kırılganlığı
- **Severity:** Medium · **Durum:** 🟧 Açık — WS1 (mainnet deploy) düzeltecek
- **Konum:** `scripts/deploy_testnet.sh` (placeholder), tüketim: marketplace `settle`
- **Açıklama:** Deploy, marketplace'i `--reputation $TOKEN_ID` placeholder'ıyla kurup
  ayrı bir tx'te `set_reputation` çağırıyor. Bu ikinci tx atlanır/başarısız olursa
  marketplace `reputation==token` ile canlı kalır ve her `settle` revert eder (token'da
  `record_settled` yok) → tüm funded invoice'lar donar.
- **Plan:** Mainnet `deploy_mainnet.sh`: reputation'ı **önce** deploy et (veya
  deterministik/önceden hesaplanmış adres) ve gerçek adresi doğrudan `__constructor`'a
  ver; deploy sonrası `reputation != token` ve bir `settle` dry-run assert et. Testnet
  placeholder deseni mainnet'e taşınmayacak.

### IC-10 — `sale_price`/`volume` checked olmayan i128 → per-invoice DoS
- **Severity:** Low · **Durum:** ✅ Fixed
- **Konum:** `contracts/marketplace/src/types.rs` (sale_price), `contracts/reputation/src/lib.rs` (volume)
- **Açıklama:** `sale_price = face_value*(10000-bps)/10000` checked değildi; `face_value`
  üst sınırı yoktu. `face_value > ~1.7e34` ile `buy_invoice` taşma paniğiyle o faturayı
  satın alınamaz yapıyordu. Reputation `volume += amount` de checked değildi.
- **Düzeltme:** `MAX_FACE_VALUE=10^24` sınırı (`FaceTooLarge`), `sale_price` artık
  `checked_mul` kullanır, reputation `volume`/sayaçlar `saturating_add` kullanır.
  - **Test:** `create_invoice_rejects_face_too_large`.

## 4. Düzeltme Özeti

| Alan | Değişiklik |
|---|---|
| `marketplace/types.rs` | `Invoice.debtor: Address`; `DataKey::Paused`; yeni error'lar (`NotDebtor`, `DueTooFar`, `NameTooLong`, `FaceTooLarge`, `Paused`); `sale_price` `checked_mul` |
| `marketplace/lib.rs` | `create_invoice` debtor param + face/name/due üst-sınır kontrolleri + pause; `settle` debtor-binding; `mark_default` `saturating_add`; `upgrade()`, `set_paused()`, `is_paused()`; read-path TTL bump; `filter()` bounded scan |
| `reputation/lib.rs` | `saturating_add` sayaç/volume; `get_score` okuma TTL bump |
| `test_token/lib.rs` | `__constructor` re-init guard; TESTNET-ONLY uyarısı |
| Testler | +7 yeni regresyon testi; mevcut testler yeni imzaya uyarlandı — **37/37 yeşil**, `clippy` temiz |

## 5. Kalan Riskler & Mainnet Öncesi Tavsiyeler

1. **IC-09 (Açık):** `deploy_mainnet.sh` reputation'ı önce deploy edip `reputation != token`
   ve `settle` dry-run assert etmeli (WS1 — deploy'un ön koşulu).
2. **IC-01 (deploy):** Mainnet'te test_token **deploy edilmez**; marketplace gerçek
   **USDC SAC** ile kurulur (WS1).
3. **IC-05/IC-08/DD-2 (ops):** Admin, deployer hot-key değil **multisig/donanım cüzdanı**
   olmalı; upgrade/pause anahtarı da aynı korumaya alınmalı.
4. **IC-06 (ürün):** Anında-avans modeli dokümante edilmeli; kullanıcıya karşı-taraf
   riski açıkça iletilmeli; reputation'ın sıfırlanamazlığı zamanla güçlendirilmeli.
5. **IC-07 (ops):** Mainnet için restore runbook hazırlanmalı; düşük-hacimli piyasada
   TTL arşivleme izlenmeli.

## 6. Yeşil Işık Durumu

Tüm **Critical/High** bulgular ele alındı (IC-02, IC-03 **Fixed**; IC-01 mitige + deploy
kararı). Objektif Medium/Low kusurlar **Fixed**. Kalan Medium bulgular ya bilinçli
tasarım kararı (IC-05, IC-06 — Acknowledged) ya da deploy adımında kapatılacak (IC-09).

> **Sonuç:** Kontrat kod tabanı, **IC-09'un `deploy_mainnet.sh`'te kapatılması ve
> IC-01/DD-2 deploy önkoşulları (gerçek USDC SAC + multisig admin)** sağlanmak kaydıyla,
> mainnet deploy'una (WS1) **hazırdır**.
