# InvoiceChain — Mainnet-Öncesi Güvenlik Audit'i (Tasarım / Spec)

- **Tarih:** 2026-07-10
- **Kapsam commit:** `475c411` (`475c41127e6c93ede44801b7cdb39ee1c156221b`)
- **Repo:** `BurcuMengu/invoicechain-mainnet`
- **Level 6 alt-projesi:** #1 — Güvenlik / Audit (mainnet deploy'un ön koşulu)
- **Master spec:** [`2026-07-10-level6-mainnet-launch-design.md`](2026-07-10-level6-mainnet-launch-design.md) (bu, WS0'ın detaylı spec'idir)

## 1. Amaç

InvoiceChain'i Stellar **mainnet**'e (pubnet) çıkarmadan önce üç Soroban
kontratını (`marketplace`, `reputation`, `test_token`) production-grade bir
denetimden geçirmek. Gerçek para (gerçek USDC) söz konusu olacağı için, deploy
öncesi bilinen tüm zafiyet sınıflarını tespit etmek, kritik/yüksek bulguları
düzeltmek ve düzeltmeleri regresyon testleriyle sabitlemek. Çıktı, ekosistem
programı için güvenilir, imzalanabilir bir audit raporudur.

## 2. Kapsam

**Kapsam içi (birincil):**
- `contracts/marketplace` — çekirdek create → buy → settle → default/cancel döngüsü, escrow, cross-contract çağrılar.
- `contracts/reputation` — issuer trust score, marketplace-gating.
- `contracts/test_token` — SEP-41 mock token + faucet (mainnet'te kaldırılacak/değiştirilecek).

**Kapsam içi (ikincil, hafif):**
- Ops/mainnet güvenlik yüzeyi: admin anahtar yönetimi, mainnet secret/env
  yönetimi, gerçek USDC SAC'a geçiş, upgrade/pause mimarisi kararları.

**Kapsam dışı:**
- Derin frontend penetrasyon testi (XSS/CSRF/tedarik zinciri) — yalnızca
  yüzeysel wallet/secret güvenlik notları eklenir.
- Mainnet deploy'un kendisi (ayrı alt-proje #2).

## 3. Metodoloji — Çok-Ajanlı Adversaryal Audit

Orkestrasyon **Workflow** aracıyla deterministik yürütülür. Tüm subagent'lar
**Opus** ile çalışır (kalite > token maliyeti).

### 3.1 Finder fan-out (paralel)
Her ajan üç kontratı da tek bir saldırı vektörü merceğinden "kırmaya" çalışır ve
yapılandırılmış bulgu (structured finding) döndürür:

| Ajan | Vektör | Aranan örnekler |
|---|---|---|
| F1 | Access control / auth | eksik `require_auth`, hatalı `require_marketplace` gating, admin yetki aşımı, auth atlatma |
| F2 | Aritmetik / overflow | `sale_price` i128 taşması, `volume += amount` taşması, negatif/precision, bölme kayıpları |
| F3 | Storage / TTL / DoS | `filter()` sınırsız döngüsü, TTL expiry ile veri kaybı, key şişmesi, gas/limit sömürüsü |
| F4 | Cross-contract / reentrancy | marketplace↔reputation akışı, CEI ihlalleri, kötü niyetli token callback |
| F5 | Ekonomik / mantık | `settle` payer semantiği, default grace period, discount sınırları, escrow muhasebesi, state-machine geçişleri |
| F6 | Mainnet / ops | test_token faucet kaldırma, gerçek USDC SAC geçişi, admin key/multisig, upgrade/pause yokluğu, deploy config |

### 3.2 Bulgu boru hattı
```
finders (paralel) → bulguları birleştir + dedup → severity ata
→ her bulguya bağımsız adversaryal doğrulama (skeptik Opus ajanı)
→ yalnızca CONFIRMED bulgular rapora
```
Adversaryal doğrulama adımı, her bulgu için ayrı bir skeptik ajana "bu gerçekten
sömürülebilir mi? Somut girdi/durum → yanlış çıktı göster; emin değilsen REFUTED"
sorusunu sorar. Böylece plausible-ama-yanlış bulgular elenir.

### 3.3 Severity ölçeği
- **Critical** — fon kaybı/çalınması, yetkisiz state mutasyonu, doğrudan sömürülebilir.
- **High** — koşullu fon riski, kalıcı DoS, ciddi muhasebe hatası.
- **Medium** — sınırlı koşullarda risk, ölçeklenme/limit sorunu.
- **Low** — küçük mantık/UX-güvenlik sapması, savunma derinliği eksiği.
- **Info** — stil/dokümantasyon/gözlem, güvenlik etkisi yok.

## 4. Deliverable — `SECURITY-AUDIT.md`

Gerçek bir Soroban audit raporu formatında, repo kökünde. Bölümler:

1. **Özet** — kapsam, commit hash, tarih, denetlenen kontratlar, metodoloji özeti.
2. **Severity özet tablosu** — sınıf başına bulgu sayısı ve Fixed/Acknowledged durumu.
3. **Bulgular** — her biri için:
   - ID (ör. `IC-01`), başlık, severity
   - Konum: `file:line`
   - Açıklama + exploit senaryosu (somut girdi/durum → sonuç)
   - Öneri
   - **Durum:** Fixed (commit) / Acknowledged (tasarım kararı)
4. **Düzeltme özeti** — uygulanan yamalar, eklenen testler.
5. **Kalan riskler & tavsiyeler** — mainnet deploy öncesi operasyonel öneriler.

## 5. Düzeltme + Test Döngüsü (TDD)

Her **CONFIRMED, objektif** bulgu için ana oturumda:
1. Açığı gösteren **başarısız regresyon testi** yaz (`contracts/<c>/src/test.rs`).
2. Kontratı düzelt.
3. Testi yeşile çevir; tüm suite'i çalıştır.

Düzeltme, ilgili bulgunun `SECURITY-AUDIT.md` durumunu "Fixed" + commit referansı
olarak günceller.

## 6. Tasarım-Kararı Bulguları (Acknowledged) — Gerekçeli

Aşağıdaki konular objektif "hata" değil; mainnet risk iştahına bağlı **tercihler**.
Audit sırasında somut hale getirilir; her biri için kullanıcıya net bir
"ekle / ekleme" seçeneği **her defasında gerekçeleriyle** sunulur ve seçim rapora
işlenir. Otomatik uygulanmaz.

### DD-1 — Upgrade edilebilirlik (upgradeability)
Kontratlar deploy sonrası sabit; bir bug bulunursa yamalanamaz.

- **Neden EKLENMELİ:** Mainnet'te gerçek para varken keşfedilen bir bug'ı
  `update_current_contract_wasm` ile düzeltebilmek, fon kaybını önleyebilir.
  Migrasyon (yeni kontrat + veri taşıma) çok daha pahalı ve kesintili olurdu.
  Erken aşama bir üründe hata olasılığı yüksektir.
- **Neden EKLENMEMELİ:** Upgrade yetkisi, admin'e kullanıcı fonlarını/mantığı tek
  taraflı değiştirme gücü verir — merkezileşme ve güven sorunu. Anahtar çalınırsa
  saldırgan kontratı kötü niyetli koda yükseltebilir. Değiştirilemezlik (immutability)
  bazı kullanıcılar için bir güven özelliğidir.
- **Öneri:** Eklenirse mutlaka multisig/timelock arkasına alınmalı (bkz. DD-2).

### DD-2 — Admin anahtar yönetimi (tek anahtar vs multisig)
`set_reputation` gibi yetkiler tek bir admin anahtarına bağlı.

- **Neden MULTISIG'e geçilmeli:** Tek anahtar tek kırılma noktası; çalınırsa admin
  yetkileri (reputation adresini değiştirme, varsa upgrade) ele geçer. Multisig,
  tek bir cihaz/anahtar sızıntısında saldırıyı engeller ve operasyonel güveni artırır.
- **Neden tek anahtar KALMALI:** Multisig operasyonel karmaşıklık, imzacı
  koordinasyonu ve acil müdahale gecikmesi ekler. Admin yetkisi görece dar
  (`set_reputation`) olduğu için saldırı yüzeyi sınırlı; solo bir kurucu için
  multisig aşırı olabilir.
- **Öneri:** En azından donanım cüzdanı; upgrade eklenirse multisig zorunlu sayılmalı.

### DD-3 — Pause / acil durdurma (circuit breaker)
Bir sorun anında `create/buy/settle`'ı durduracak switch yok.

- **Neden EKLENMELİ:** Aktif bir sömürü/bug fark edildiğinde kontratı dondurup
  daha fazla zararı durdurabilmek, incident response'un temel aracıdır. Bir gecede
  fon akışını kesebilmek mainnet'te değerlidir.
- **Neden EKLENMEMELİ:** Pause, admin'e kullanıcıların fonlarını/işlemlerini
  bloke etme gücü verir (censorship/rug riski algısı). Kötüye kullanılırsa
  kullanıcı `settle` edemez. Ek state + her giriş noktasında kontrol karmaşıklığı.
- **Öneri:** Eklenirse yalnızca "yeni işlem" (create/buy) durdurulmalı; mevcut
  funded invoice'ların `settle` edilmesi asla bloke edilmemeli (fon kilitlenmesin).

### DD-4 — `settle` payer semantiği
Şu an *herkes* payer olarak bir funded invoice'ı face_value ödeyerek settle edebilir.

- **Neden AÇIK BIRAKILMALI:** Üçüncü taraf ödemesi owner'ın zararına değil — owner
  face_value alır, seller reputation kazanır. Gerçek dünyada borcu bir garantör/
  faktör ödeyebilir; esneklik faydalı. Kısıtlama ek karmaşıklık ve gereksiz red.
- **Neden KISITLANMALI:** "Borçlu dışında biri neden ödesin?" belirsizliği;
  reputation her zaman `seller`'a yazılıyor, oysa ödeyen farklı olabilir —
  reputation'ın anlamı bulanıklaşabilir. Beklenmedik ödeme akışları muhasebeyi
  zorlaştırabilir.
- **Öneri:** Açık bırak; ama reputation'ın "seller'ın invoice'ı zamanında
  kapandı" anlamına geldiğini dokümante et (ödeyenin kimliğinden bağımsız).

### DD-5 — `filter()` sınırsız döngüsü (indeksleme vs off-chain)
`list_open`/`list_by_owner`/`list_by_seller`, `0..NextId` aralığını on-chain gezer.

- **Neden ON-CHAIN İNDEKS/PAGINATION EKLENMELİ:** Invoice sayısı büyüdükçe bu
  fonksiyonlar tüm invoice'ları okur — read maliyeti ve limit riski artar; belli
  bir noktadan sonra çağrı limitlere takılıp DoS'a dönebilir (fonksiyonel bozulma).
- **Neden EKLENMEMELİ (off-chain'e bırak):** Frontend zaten var ve chain event'lerini
  (created/funded/settled...) bir indexer/RPC ile toplayabilir; liste sorgularını
  off-chain yapmak on-chain karmaşıklığı ve depolama maliyetini düşürür. On-chain
  liste fonksiyonları çoğunlukla kolaylık amaçlı.
- **Öneri:** On-chain liste fonksiyonlarını "best-effort/limitli" olarak işaretle;
  production listeleme için event-tabanlı off-chain indexer'ı standart yol yap.
  (Bu madde aynı zamanda severity'li bir DoS **bulgusu** olarak da ele alınır.)

## 7. Doğrulama & Çıkış Kriterleri

Audit "tamam" sayılır ancak şunlar sağlandığında:
- [ ] Tüm kontratlarda `cargo test` yeşil (yeni regresyon testleri dahil).
- [ ] `cargo clippy` uyarısız (veya gerekçeli `allow`).
- [ ] Tüm **Critical** ve **High** bulgular **Fixed**.
- [ ] Tüm **Medium+** tasarım-kararı bulguları kullanıcıya gerekçeleriyle sunulmuş
      ve kararı rapora işlenmiş (Fixed veya Acknowledged).
- [ ] `SECURITY-AUDIT.md` yazılmış ve commit'lenmiş.
- [ ] Rapor, mainnet deploy alt-projesi (#2) için "yeşil ışık" durumunu belgeliyor.

## 8. Bu Alt-Projenin Sonraki Adımlarla İlişkisi

Bu audit, Level 6 sırasının ilk adımı:
`audit (#1) → mainnet deploy (#2) → gerçek kullanıcı adaptasyonu (#3) → launch/pazarlama (#4)`.
Audit'in "yeşil ışığı" ve DD kararları (özellikle upgrade/admin/pause), #2'deki
deploy mimarisini doğrudan şekillendirir.
