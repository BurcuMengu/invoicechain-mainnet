# Soroban'da Fatura Faktoringi + Gasless Onboarding: InvoiceChain'i Nasıl İnşa Ettim

> **Ekosistem katkısı (R11).** Yayına hazır teknik tutorial. Önerilen mecralar:
> dev.to, Medium, Stellar Developers Discord `#showcase`, ya da repo `docs/`.
> Kod parçaları gerçek projedendir: `github.com/BurcuMengu/invoicechain-mainnet`.

Fatura faktoringi eski bir finansal ürün: bir işletme 30–90 gün sonra ödenecek bir
faturayı, bugün nakde ihtiyacı olduğu için iskontoyla bir finansöre satar. Bunu
Stellar/Soroban üzerinde aracısız ve şeffaf yapabilir miyiz? Üstelik yeni bir
kullanıcı **hiç XLM tutmadan** ilk işlemini yapabilir mi? Bu yazıda InvoiceChain'in
iki ilginç parçasını anlatıyorum: **cross-contract itibar sistemi** ve **gasless
onboarding mimarisi** — ve bir güvenlik denetiminin bize öğrettiği somut bir dersi.

## 1. Üç kontrat, tek döngü

InvoiceChain üç Soroban kontratından oluşur:

- **`marketplace`** — çekirdek `create → buy → settle → default` döngüsü.
- **`reputation`** — adres başına zincir-üstü güven skoru.
- **`token`** — ödeme varlığı (mainnet'te kanonik **USDC SAC**, testnet'te bir SEP-41 mock).

Fatura bir state machine izler: `Listed → Funded → Settled | Defaulted | Cancelled`.
Satıcı listeler, yatırımcı iskontolu fiyatı ödeyip sahibi olur, borçlu vadede tam
tutarı ödeyince fatura kapanır.

## 2. Cross-contract çağrıları güvenle: "sadece marketplace" kapısı

İtibar puanının anlamlı olması için **yalnızca gerçek settle/default olaylarıyla**
değişmesi gerekir — keyfi çağıranlar puanı oynatamamalı. Soroban'da bunu
cross-contract auth ile çözüyoruz: reputation kontratı, çağıranın yapılandırılmış
marketplace olduğunu doğrular.

```rust
fn require_marketplace(env: &Env) {
    let mkt: Address = env.storage().instance().get(&DataKey::Marketplace).unwrap();
    mkt.require_auth();
}

pub fn record_settled(env: Env, party: Address, amount: i128) {
    require_marketplace(&env);            // ← yalnızca marketplace geçebilir
    let mut s = read_score(&env, &party);
    s.settled_count = s.settled_count.saturating_add(1);
    s.volume = s.volume.saturating_add(amount);
    // ...
}
```

Marketplace tarafında da cross-contract client ile çağırıyoruz (crate'i doğrudan
linklemek yerine `#[contractclient]` kullanmak, wasm sembol çakışmalarını önler):

```rust
#[contractclient(name = "ReputationClient")]
pub trait ReputationInterface {
    fn record_settled(env: Env, party: Address, amount: i128);
    fn record_defaulted(env: Env, party: Address);
}
```

**Ders:** cross-contract mutasyonlarda daima çağıran-kimliğini doğrulayın ve
sayaçlarda `saturating_add` kullanın — bir taşma paniği tüm akışı DoS edebilir.

## 3. Denetimin öğrettiği ders: itibarı *gerçek* borçluya bağlamak

Mainnet öncesi çok-ajanlı adversaryal bir denetim yaptık. En öğretici bulgu (IC-02)
şuydu: ilk tasarımda `settle`'ı **herkes** çağırabiliyordu ve faturada borçlunun
gerçek adresi yoktu (yalnızca bir görüntü etiketi). Sonuç: bir satıcı iki cüzdanla
kendi kendine ödeme yapıp **sahte itibar** üretebilirdi (net-sıfır maliyetle) — sonra
gerçek yatırımcıları bu sahte puana güvendirebilirdi.

Düzeltme, itibarı zincir-üstü bir kimliğe bağlamaktı: faturaya `debtor: Address`
ekledik ve `settle`'ın yalnızca o borçlu tarafından yapılmasını zorunlu kıldık.

```rust
pub fn settle(env: Env, id: u64, payer: Address) {
    payer.require_auth();
    let mut inv = read_invoice(&env, id);
    if inv.status != Status::Funded { panic_with_error!(&env, MarketError::NotFunded); }
    // IC-02: yalnızca gerçek borçlu ödeyebilir → itibar "borçlu ödedi" demektir
    if payer != inv.debtor { panic_with_error!(&env, MarketError::NotDebtor); }
    // ... CEI: state yaz, sonra transfer + reputation çağrısı
}
```

**Ders:** "itibar/skor" gibi zincir-üstü sinyaller Sybil'e açık olabilir. Sinyali
gerçek, harcamalı bir eyleme (burada: gerçek borçlunun ödemesi) bağlayın.

## 4. Gasless onboarding: kullanıcının XLM duvarını kaldırmak

Yeni bir kullanıcının önündeki en büyük sürtünme "önce XLM edin"dir. Stellar'da bir
işlemin ücreti **fee-bump** ile başka bir hesaba ödettirilebilir. Biz bunu
[Launchtube](https://launchtube.xyz) üzerinden yapıyoruz, ama iki gerçek sorunu
çözmek gerekti: (1) sponsor token'ı istemciye sızmamalı, (2) kötüye kullanım
sınırlanmalı. Statik bir frontend bunları yapamaz — araya **minimal bir Cloudflare
Worker** koyduk.

Akış:

```
Frontend  ──imzalı XDR──►  Cloudflare Worker  ──►  Launchtube  ──►  Stellar
          (env-gated)      (token gizli,           (fee-bump)
                            allowlist + rate-limit)
```

Frontend tarafı **asla token görmez** ve her zaman güvenli tarafta kalır — sponsor
başarısız olursa normal "cüzdan öder" yoluna şeffafça düşer:

```ts
export async function submitSponsored(signedXdr: string): Promise<SponsorResult> {
  const url = sponsorUrl()
  if (url === '') return { sponsored: false, reason: 'disabled' }
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ xdr: signedXdr }) })
    if (!res.ok) return { sponsored: false, reason: 'unavailable' }  // → çağıran fallback yapar
    return { sponsored: true, hash: (await res.json()).hash }
  } catch { return { sponsored: false, reason: 'unavailable' } }     // asla throw etmez
}
```

Worker, imzalı işlemi **parse edip allowlist'ler** (yalnızca marketplace'in
`create/buy/settle`'ı + USDC `approve`'u sponsorlanır), adres ve IP başına KV ile
rate-limit uygular, sonra token'ı server-side ekleyip Launchtube'a iletir:

```ts
const v = validateInvoke(body.xdr, env.NETWORK_PASSPHRASE, { marketplaceId, tokenId })
if (!v.ok) return new Response(v.msg, { status: v.status })     // allowlist dışı → 403
if (await bump(env.RL, `addr:${v.source}`) > LIMIT) return new Response('...', { status: 429 })
```

**İki incelik (denetimden çıkan):**
- Cross-origin `fetch` bir **CORS preflight** tetikler; Worker `OPTIONS`'ı 204 +
  `Access-Control-Allow-*` ile yanıtlamalı — yoksa sponsor tarayıcıda sessizce
  başarısız olur (fail-safe olduğu için tx yine tamamlanır ama hiç sponsorlanmaz).
- Sponsorluk her yerde **env-gated**; kapalıyken davranış byte-byte eski akışla aynı.

## 5. Çıkarımlar

- **Cross-contract auth** ile durum-mutasyonlarını kısıtlayın; sayaçlarda taşmaya
  karşı `saturating_*` kullanın.
- **Zincir-üstü sinyalleri Sybil'e karşı sağlamlaştırın** — gerçek, harcamalı bir
  eyleme bağlayın.
- **Gasless UX** güçlü bir onboarding aracı; ama sponsor kimliğini bir kenar
  proxy'sinde gizleyin, allowlist + rate-limit ekleyin ve daima **güvenli fallback**
  bırakın.
- Mainnet'e çıkmadan önce **adversaryal bir denetim** yapın; en değerli dersler
  "plausible ama yanlış" varsayımları kırmaktan gelir.

Kod, denetim raporu ve kullanıcı kılavuzu repo'da:
**github.com/BurcuMengu/invoicechain-mainnet** — sorular ve PR'lar açık. Stellar
üzerinde inşa edenlere faydalı olması dileğiyle. 🚀
