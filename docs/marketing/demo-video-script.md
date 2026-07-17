# Demo Video — Senaryo + Çekim Listesi (R10)

> Hedef: ~90 saniye, sesli anlatım + ekran kaydı. Testnet app'ten çekilebilir
> (mainnet gerekmez): [burcumengu.github.io/invoicechain](https://burcumengu.github.io/invoicechain).
> Araç önerisi: QuickTime/OBS ekran kaydı + (opsiyonel) sesli anlatım. Dışa aktarım:
> 1080p mp4; sosyal için ayrıca kare/dikey kırpım.
>
> Çekim öncesi hazırlık: iki test cüzdanı (satıcı + yatırımcı), faucet'ten USDC,
> tarayıcıyı temiz bir pencerede aç, bildirimleri kapat.

---

## Akış (sahne sahne)

| # | Süre | Ekran (çekim) | Anlatım / alt yazı |
|---|---|---|---|
| 1 | 0:00–0:08 | Landing page, logo + "tokenize & factor invoices on Stellar" | "InvoiceChain — ödenmemiş faturaları Stellar üzerinde bugün nakde çevir." |
| 2 | 0:08–0:16 | **Connect** → cüzdan seç → bağlan; üstte adres+bakiye | "Cüzdanını bağla. Yeniysen ve XLM'in yoksa sorun değil — birazdan göreceksin." |
| 3 | 0:16–0:30 | **Create** sayfası: borçlu adresi, borçlu adı, yüz değeri (100 USDC), iskonto (%10), vade → Create → imza | "Bir fatura oluştur: 100 USDC, %10 iskonto. Borçlunun cüzdanını da giriyoruz — sadece o kapatabilir." |
| 4 | 0:30–0:38 | İşlem onayında **"⚡ Gasless"** rozeti | "Dikkat: ücreti sponsor ödedi. Cüzdanında XLM tutmana gerek yok." |
| 5 | 0:38–0:52 | (Yatırımcı cüzdanına geç) **Marketplace**: listelenen fatura → **Buy** → approve + buy → owner değişir | "Yatırımcı olarak iskontolu fiyattan — 90 USDC — satın al. Para anında satıcıya gider." |
| 6 | 0:52–1:04 | **Portfolio**: fatura Funded → **Settle** (borçlu) → Settled | "Vadede borçlu 100 USDC öder; yatırımcı tam tutarı toplar." |
| 7 | 1:04–1:14 | Satıcının **itibar puanı** artışı (settled +1) | "Ve satıcının zincir-üstü itibarı yükselir — iyi ödeyenler zamanla daha çok güven kazanır." |
| 8 | 1:14–1:24 | Repo + `SECURITY-AUDIT.md` + kod hızlı gösterim | "Açık kaynak, Soroban-native ve mainnet öncesi bağımsız güvenlik denetiminden geçti." |
| 9 | 1:24–1:30 | Kapanış kartı: logo + demo linki + "#Stellar #Soroban" | "Dene: [link]. Faturalar, zincirde." |

## Çekim notları
- 3. ve 5. adımlarda formu **yavaş** doldur; izleyici alanları okuyabilsin.
- 4. adımdaki "⚡ Gasless" rozetini **yakınlaştır** (en güçlü diferansiyatör).
- Gerçek tutarlar küçük olsun (100 USDC testnet) — net görünsün.
- Mainnet canlıya geçince: aynı akışı mainnet'te tekrar çekip "gerçek USDC" vurgusu ekle.
- Ses yoksa: her sahneye kısa **alt yazı** koy (yukarıdaki "Anlatım" sütunu birebir kullanılabilir).

## Yayın
- Twitter launch thread'in 1. tweet'ine göm (bkz. `twitter-launch-thread.md`).
- README "Live demo" bölümüne ve submission'a link ekle.
