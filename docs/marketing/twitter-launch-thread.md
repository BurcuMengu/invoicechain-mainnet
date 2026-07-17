# Twitter/X Launch Thread — InvoiceChain (R9)

> Kullanım: her numaralı blok bir tweet. `[…]` yer tutucularını yayın anında doldur
> (mainnet linkleri deploy sonrası). Stellar ekosistem hesaplarını etiketle:
> **@StellarOrg @BuildOnStellar @DefinitelyStellar**. Görsel olarak 1. tweet'e demo
> GIF'ini (`docs/demo.gif`), sonraki tweet'lere ekran görüntülerini ekle.

---

**1/ 🧾⚡ InvoiceChain'i tanıtıyorum — Stellar/Soroban üzerinde bir fatura faktoring pazarı.**

İşletmeler ödenmemiş faturalarını bugün nakde çevirir; yatırımcılar iskontoyla alıp getiri kazanır. Tamamı zincir üstünde, **gasless onboarding** ile — yeni kullanıcı ücret için XLM tutmadan başlar.

🔗 Demo: [burcumengu.github.io/invoicechain](https://burcumengu.github.io/invoicechain)
🧵👇

**2/ Sorun:** KOBİ'ler için nakit akışı. Bir fatura 30–90 gün sonra ödenir, ama para bugün lazım. Geleneksel faktoring yavaş, aracı dolu ve şeffaf değil.

**Çözüm:** Faturayı tokenize et, iskontolu sat, borçlu ödeyince yatırımcı tam tutarı toplar. Aracısız, şeffaf, anlık.

**3/ Nasıl çalışıyor (create → buy → settle):**
• Satıcı faturayı listeler (yüz değeri, iskonto, vade, **borçlu adresi**)
• Yatırımcı iskontolu fiyattan alır → para anında satıcıya
• Borçlu vadede tam tutarı öder → yatırımcı toplar, satıcının **itibarı** artar
• Ödenmezse → temerrüt, itibar düşer

**4/ ⚡ Öne çıkan özellik — Gasless onboarding.**

Yeni kullanıcının önündeki en büyük duvar: "önce XLM edin." Biz kaldırdık.

İlk işlemlerin ağ ücretini bir sponsor **Launchtube** fee-bump ile öder. Kullanıcı sadece imzalar. Cüzdanda XLM=0 → yine de create/buy/settle yapabilir.

**5/ 🔒 Güvenlik önce.**

Mainnet'e çıkmadan önce çok-ajanlı **adversaryal güvenlik audit'i** yaptık: 10 bulgu, tümü ele alındı (fon-çalma/reentrancy yok). İtibar-şişirme, DoS ve aritmetik güvenlik dahil hepsi TDD ile düzeltildi.

Rapor repo'da: `SECURITY-AUDIT.md`

**6/ 🛠 Tamamen açık kaynak & Stellar-native:**
• 3 Soroban kontratı (marketplace / reputation / SEP-41 token)
• React + Stellar Wallets Kit + @stellar/stellar-sdk
• Gerçek USDC (SAC) ile mainnet
• Cloudflare Worker + Launchtube ile gasless

Repo: [github.com/BurcuMengu/invoicechain-mainnet]

**7/ Dene, geri bildirim ver, katkı yap 🙌**

📱 Canlı demo: [link]
📖 Kullanıcı kılavuzu: `docs/USER-GUIDE.md`
📝 Nasıl inşa ettiğimizi anlatan teknik yazı: [blog linki]

Stellar ekosistemine küçük bir katkı olsun. Sorular/PR'lar açık!

#Stellar #Soroban #DeFi #RWA
