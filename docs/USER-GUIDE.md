# InvoiceChain — Kullanıcı Kılavuzu

InvoiceChain, faturaları (invoice) zincir üzerinde alınıp satılabilen bir
**faktoring pazarıdır**: bir satıcı gelecekte ödenecek bir faturayı iskontoyla
bugün nakde çevirir; bir yatırımcı iskontolu fiyattan alır ve borçlu ödediğinde
tam tutarı toplar. Bu kılavuz adım adım nasıl kullanılacağını anlatır.

> **Ağlar:** Uygulama hem **testnet** (deneme, sahte USDC) hem **mainnet** (gerçek
> USDC) ile çalışır. Testnet'te para gerçek değildir — güvenle denemek için oradan
> başlayın.

---

## 1. Roller

| Rol | Ne yapar |
| --- | --- |
| **Satıcı (seller)** | Faturayı oluşturur ve iskontoyla listeler (bugün nakit için) |
| **Yatırımcı (investor)** | Listelenen faturayı iskontolu fiyattan satın alır |
| **Borçlu (debtor)** | Vade gelince faturayı tam yüz değeri (face value) üzerinden öder (settle) |

Aynı cüzdanla farklı zamanlarda farklı roller üstlenebilirsiniz.

---

## 2. Ön hazırlık: cüzdan ve hesap

1. **Bir Stellar cüzdanı kurun.** [Freighter](https://www.freighter.app/) tarayıcı
   eklentisi önerilir (uygulama Stellar Wallets Kit ile başka cüzdanları da destekler).
2. **Bir Stellar hesabınız olsun.**
   - **Testnet:** Uygulama, hesabınızı gerekiyorsa otomatik olarak Friendbot ile
     fonlar; ek işlem gerekmez.
   - **Mainnet:** Hesabınızın var olması ve minimum XLM rezervini (yaklaşık 1 XLM)
     karşılaması gerekir. Bir borsadan/başka cüzdandan biraz XLM gönderin.
3. **Cüzdanı bağlayın.** Uygulamada sağ üstteki **Connect** ile cüzdanınızı seçip
   yetki verin. Bağlandığınızda adresiniz (G… ile başlar) ve bakiyeniz üstte görünür.

> **⚡ Gasless onboarding:** Uygulama fee-sponsorship ile yapılandırılmışsa, yeni
> kullanıcının ilk birkaç işleminin **ağ ücreti sponsor tarafından ödenir** — yani
> ücret için XLM tutmanıza gerek kalmaz. Bir işlem sponsorlandığında "⚡ Gasless"
> bildirimi görürsünüz. Sponsorluk kapalı/dolu ise işlem normal şekilde (ücreti siz
> ödeyerek) tamamlanır; hiçbir işlem bu yüzden başarısız olmaz.

---

## 3. USDC edinme ve trustline

Faturalar **USDC** ile alınıp ödenir. USDC'yi tutabilmek için cüzdanınızda bir
**trustline** (güven hattı) olmalıdır.

- **Testnet:** Uygulamadaki **Ramp / faucet** sayfasından deneme USDC'si alın;
  gerektiğinde trustline otomatik kurulur. (Bu tamamen sahte para ve testnet'e özeldir.)
- **Mainnet:** Cüzdanınızda **kanonik USDC** için trustline ekleyin (Freighter'da
  "Add asset" → USDC). Ardından bir borsadan/anchor'dan USDC'yi Stellar adresinize
  çekin. Yatırımcı ve borçlu rollerinde ödeme yapabilmek için USDC bakiyeniz olmalı.

---

## 4. Fatura oluşturma (satıcı)

**Create** sayfasında:

1. **Borçlu cüzdan adresi (G…):** Faturayı sonunda ödeyecek gerçek borçlunun Stellar
   adresi. **Zorunludur ve doğrulanır** — yalnızca bu adres faturayı `settle`
   edebilir, böylece itibar puanı "borçlu gerçekten ödedi" anlamına gelir.
2. **Borçlu adı:** Görüntüleme etiketi (en fazla 64 karakter).
3. **Yüz değeri (face value):** Vadede ödenecek toplam USDC.
4. **Vade (due):** Faturanın ödenmesi gereken ledger. Gelecekte olmalı ve makul bir
   ufkun (yaklaşık 1 yıl) içinde olmalıdır.
5. **İskonto (%):** Yatırımcının ödeyeceği indirimli fiyatı belirler. Örn. 100 USDC
   yüz değeri + %10 iskonto → yatırımcı **90 USDC** öder; borçlu vadede **100 USDC**
   öder. (İzin verilen aralık: %0.01–%90.)

**Create** deyin ve cüzdanda imzalayın. Fatura **Listed** durumunda pazara düşer.

> İpucu: `create_invoice` tek işlemdir ve `approve` gerektirmez — bu yüzden gasless
> yapılandırmasında **tamamen ücretsiz** olan akıştır.

---

## 5. Fatura satın alma (yatırımcı)

**Marketplace** sayfasında listelenen faturaları görürsünüz (yüz değeri, iskonto,
indirimli fiyat, vade). Bir faturayı seçip **Buy** deyin. İki imza olur:

1. **Approve:** Marketplace kontratına, indirimli fiyatı USDC bakiyenizden çekme
   izni verirsiniz.
2. **Buy:** Fatura **Funded** olur, sahibi (owner) siz olursunuz ve indirimli fiyat
   anında satıcıya gider.

Artık faturanın sahibisiniz; borçlu ödediğinde **tam yüz değerini** siz toplarsınız.

> **Risk notu:** Para satın alma anında satıcıya gider (escrow yoktur — bu bir
> faktoring-avans modelidir). Borçlu ödemezse fatura **Defaulted** işaretlenir ve
> satıcının itibarı düşer, ancak avans otomatik geri gelmez. Satıcının itibar
> puanına bakarak risk değerlendirin.

---

## 6. Faturayı ödeme / kapatma — settle (borçlu)

Vade geldiğinde, **faturadaki borçlu adresi** (bkz. adım 4) **Portfolio** sayfasından
faturayı **Settle** eder. İki imza olur:

1. **Approve:** Marketplace'e yüz değerini USDC'nizden çekme izni.
2. **Settle:** Yüz değeri faturanın sahibine (yatırımcıya) ödenir, fatura **Settled**
   olur ve **satıcının itibar puanı artar**.

> Yalnızca faturada kayıtlı borçlu adresi settle edebilir. Başka bir adres denerse
> işlem `NotDebtor` ile reddedilir — bu, sahte itibar üretimini engeller.

---

## 7. Temerrüt — mark default (yatırımcı)

Borçlu, vade + kısa bir ödemesiz süre (grace period, ~1 gün) geçmesine rağmen
ödemediyse, faturanın **sahibi (yatırımcı)** **Portfolio**'dan **Mark default**
diyebilir. Fatura **Defaulted** olur ve satıcının itibarına temerrüt kaydı düşer.

---

## 8. İtibar (reputation)

Her satıcı adresinin zincir üstünde bir **itibar puanı** vardır:

- **Settled sayısı / hacim:** Zamanında kapatılan faturalar.
- **Defaulted sayısı:** Temerrüde düşen faturalar.

Bu değerler yalnızca gerçek `settle`/`default` olaylarıyla değişir (marketplace
kontratı tarafından gated'dır; keyfi olarak yazılamaz). Yatırımcılar bir faturayı
almadan önce satıcının itibarına bakmalıdır.

---

## 9. Fatura yaşam döngüsü (özet)

```
                 create_invoice (satıcı)
                        │
                        ▼
                    ┌────────┐   cancel_invoice (satıcı)
                    │ Listed │ ─────────────► Cancelled
                    └───┬────┘
              buy_invoice (yatırımcı: approve + buy)
                        │
                        ▼
                    ┌────────┐
                    │ Funded │
                    └───┬────┘
          ┌─────────────┴───────────────┐
   settle (borçlu:            mark_default (yatırımcı,
   approve + settle)          vade + grace sonrası)
          │                             │
          ▼                             ▼
      ┌────────┐                   ┌───────────┐
      │Settled │                   │ Defaulted │
      └────────┘                   └───────────┘
   satıcı itibarı ↑              satıcı itibarı ↓
```

---

## 10. Sık karşılaşılan sorunlar

| Belirti | Neden / çözüm |
| --- | --- |
| "Account not found" | (Mainnet) Hesabınız henüz oluşturulmamış — biraz XLM gönderin. (Testnet) Sayfayı yenileyin; Friendbot fonlaması gecikmiş olabilir. |
| İşlem "insufficient balance" | USDC bakiyeniz veya (gasless kapalıysa) ücret için XLM'niz yetersiz. |
| `NotDebtor` hatası (settle) | Settle'ı yalnızca faturadaki **borçlu adresi** yapabilir. Doğru cüzdanla bağlı olduğunuzdan emin olun. |
| `NotDueYet` (mark default) | Vade + grace süresi henüz dolmadı. |
| USDC görünmüyor | Trustline eksik — cüzdanınıza USDC trustline'ı ekleyin (bkz. adım 3). |
| "⚡ Gasless" hiç çıkmıyor | Sponsorluk yapılandırılmamış ya da kotanız dolmuş olabilir; işlemler yine de normal şekilde tamamlanır. |

---

## 11. Güvenlik notları

- Uygulama işlemleri **cüzdanınızda imzalanır**; özel anahtarınız hiçbir zaman
  uygulamayla veya sponsor servisiyle paylaşılmaz.
- Kontratlar mainnet öncesi bağımsız bir **güvenlik denetiminden** geçmiştir; bkz.
  [`SECURITY-AUDIT.md`](../SECURITY-AUDIT.md).
- Gasless sponsor servisi yalnızca izin verilen marketplace işlemlerini iletir ve
  Launchtube token'ı istemciye asla ulaşmaz; ayrıntı için
  [`sponsor-worker/README.md`](../sponsor-worker/README.md).
