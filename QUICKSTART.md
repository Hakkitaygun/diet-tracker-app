# ⚡ Hızlı Başlangıç Kılavuzu

## 1️⃣ İlk Adım: Uygulamayı Başlatın

PowerShell veya Command Prompt'ı açın ve şu komutları çalıştırın:

```bash
# Proje dizinine git
cd "c:\Users\sthak\OneDrive\Desktop\HakkiTaygun\HakkiTaygun\src\dropnumbergame\diet-tracker-app"

# İlk kez mi çalıştırıyorsunuz? Bağımlılıkları yükleyin
npm install

# Uygulamayı başlat
npm run dev
```

## 2️⃣ Tarayıcıda Açın

Otomatik olarak açılmadıysa:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## 3️⃣ Profil Oluşturun

1. Adınız, yaşınız, boyunuz, kilonuz girin
2. Hedefinizi seçin (Kilo vermek, Kas kazanmak, vb.)
3. "Profili Oluştur" butonuna tıklayın

## 4️⃣ Yemek Eklemeye Başlayın

1. "Beslenme Takibi" sekmesine girin
2. "Yeni Yemek Ekle" bölümünde yemek türü seçin
3. "Yemek Oluştur" butonuna tıklayın
4. Gıda arayın ve ekleyin
5. Kaloriler otomatik hesaplanır!

## 5️⃣ Önerileri Görün

"Öneriler" sekmesinde:
- AI destekli diyetisyen tavsiyeleri
- Beslenme analizi
- Yemek önerileri
- Makronutrient dağılımı

## 6️⃣ İstatistikleri Takip Edin

"İstatistikler" sekmesinde:
- Haftalık/aylık kaloriler
- Trend grafikleri
- Ortalama beslenme değerleri

## 🎨 UI Öğelerine Giriş

### Ana Sayfa (Dashboard)
- **Günlük Kalori Hedefi**: Kalan kalorilerinizi görün
- **Makronutrientler**: Protein, Karbohidrat, Yağ
- **Bugünün Yemekleri**: Eklediğiniz yemekleri listeler

### Beslenme Takibi (Meal Tracker)
- **Gıda Arama**: 100+ gıda içinde arayın
- **Otomatik Hesaplama**: 100g bazlı kaloriler
- **Yemek Yönetimi**: Günlük yemekleri görün

### AI Önerileri (Recommendations)
- **Diyetisyen Tavsiyeleri**: Yapay zeka tabanlı
- **Beslenme Analisi**: Makronutrient oranları
- **Yemek Önerileri**: Kahvaltı, Öğle, Akşam

### İstatistikler (Analytics)
- **Çizelgeler**: Kalori ve makronutrient grafikleri
- **Trendler**: Haftalık/aylık değişimler
- **İçgörüler**: Kişiselleştirilmiş tavsiyeler

### Profil (User Profile)
- **Bilgi Güncelleme**: Yaş, kilo, hedef
- **Kilo Takibi**: Ağırlık değişimlerini kaydedin
- **Geçmiş**: Önceki kilo ölçümleri

## 💡 Faydalı İpuçları

### Kalori Hedefi Nasıl Çalışır?
- Sistem kilonuza, yaşınız ve cinsiyete göre hedef hesaplar
- Harris-Benedict formülü kullanılır
- Manuel olarak değiştirebilirsiniz

### Makronutrientler
- **Protein**: %20-30 (Kas korunması)
- **Karbohidrat**: %45-65 (Enerji)
- **Yağ**: %20-35 (Hormon üretimi)

### Beslenme İpuçları
- Günlük hedefin %80-120'sini tüketin
- Su içmeyi unutmayın
- Kahvaltı yapmak önemli
- Porsiyon kontrolü yapın

## 🔧 Sorun Giderme

### Uygulamanın yavaş açılması
```bash
# cache'i temizle
# node_modules klasörünü sil ve yeniden yükle
npm install
```

### Verilerin kaybolması
Tarayıcınızın local storage'ını temizlediğinizde veriler silinir.
Önemli verilerin yedekini alın.

### Port çakışmaları
Eğer port 3000 veya 5000 meşgulse:
- Diğer uygulamaları kapatın
- Veya `server/index.js`'de PORT'u değiştirin

## 📱 Mobil Uyumluluğu

Uygulama tamamen mobil uyumludur! Telefonunuzdan da kullanabilirsiniz:

1. Aynı ağda olduğunuzdan emin olun
2. Bilgisayarınızın IP adresini öğrenin (ipconfig)
3. Telefonda http://[IP]:3000 gidin

## 📊 Verileri İthal/İhraç Etme

SQLite veritabanını yedeklemek için:
```bash
# Veritabanını kopyalayın
server/diet_tracker.db
```

## 🚀 Sonraki Adımlar

1. **Kilo takibine başlayın**: Profilde "Kilo Kaydet"
2. **Haftalık göz at**: İstatistikleri kontrol edin
3. **AI önerilerini uygulayin**: Beslenme alışkanlıklarını iyileştirin

## ❓ Sık Sorulan Sorular

**S: Başka gıdalar ekleyebilir miyim?**
C: Evet! `server/foodDatabase.js` dosyasını düzenleyebilirsiniz.

**S: Verilerim güvenli mi?**
C: Evet, tüm veriler yerel olarak kaydedilir.

**S: Çevrimdışı kullanabilir miyim?**
C: Evet, internet bağlantısı gerekmez.

**S: Başka cihazlarda verilerim var mı?**
C: Hayır, veriler sadece bu cihazda saklanır.

---

**Keyifli diyetini geçir!** 🥗💚
