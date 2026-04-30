# 🥗 Diyetisyen - Beslenme Takip Uygulaması

Yediklerinizi takip etmenizi, günlük kalori ve makro değerlerini görmenizi ve öğünlerinizi yönetmenizi sağlayan bir beslenme takip uygulaması.

## ✨ Özellikler

### 📊 Ana Özellikler
- **Akıllı Yemek Takibi**: Yediklerinizi yazın, kalori otomatik hesaplansın
- **Beslenme Analizi**: Makronutrient dağılımı ve günlük özetler
- **İstatistikler**: Günlük ve haftalık trendleri takip edin
- **Kilo Takibi**: Kilo değişimini izleyin
- **Gıda Arama**: Kayıtlı gıdaları hızlıca bulun ve öğüne ekleyin

### 🎨 UI/UX
- Güzel ve şık arayüz
- Renkli istatistik grafikleri
- Mobil uyumlu responsive tasarım
- Kolay kullanım

## 🚀 Kurulum

### Ön Gereksinimler
- Node.js (14+ ve üzeri)
- npm veya yarn

### Adım 1: Depoyu Klonlayın
```bash
cd "c:\Users\sthak\OneDrive\Desktop\HakkiTaygun\HakkiTaygun\src\dropnumbergame\diet-tracker-app"
```

### Adım 2: Bağımlılıkları Yükleyin
```bash
# Tüm bağımlılıkları yükle
npm install

# Bu komut otomatik olarak server ve client bağımlılıklarını yükleyecektir
```

### Adım 3: Uygulamayı Çalıştırın

#### Geliştirme Modu (Development)
```bash
npm run dev
```
Bu komut aynı anda server (port 5000) ve client (port 3000) başlatır.

#### Üretim Modu (Production)
```bash
# Client'ı build et
cd client && npm run build

# Server'ı çalıştır
cd ../server && npm start
```

## 📁 Proje Yapısı

```
diet-tracker-app/
├── server/                 # Node.js Express Backend
│   ├── index.js           # Ana server dosyası
│   ├── database.js        # SQLite database konfigürasyonu
│   ├── foodDatabase.js    # Gıda veritabanı
│   ├── routes/
│   │   ├── food.js       # Gıda API endpoints
│   │   ├── meals.js      # Yemek API endpoints
│   │   └── user.js       # Kullanıcı yönetimi API
│   ├── package.json
│   └── .env              # Çevre değişkenleri
│
├── client/                 # React Frontend
│   ├── public/
│   │   └── index.html    # HTML template
│   ├── src/
│   │   ├── App.js        # Ana uygulama
│   │   ├── App.css       # Stil dosyaları
│   │   └── components/
│   │       ├── Dashboard.js          # Ana sayfa
│   │       ├── MealTracker.js        # Yemek takibi
│   │       ├── UserProfile.js        # Kullanıcı profili
│   │       └── [bileşen].css        # Stil dosyaları
│   ├── package.json
│   └── index.js
│
└── package.json            # Root package.json

```

## 🗄️ Veritabanı

Uygulama SQLite kullanmaktadır. Veritabanı otomatik olarak ilk çalıştırmada oluşturulur.

### Tablolar
- **users**: Kullanıcı bilgileri
- **meals**: Günlük yemekler
- **meal_items**: Yemek öğeleri
- **food_database**: Gıda veritabanı (100+ gıda)
- **daily_summary**: Günlük beslenme özeti
- **health_metrics**: Kilo vb. ölçümler

## 🔌 API Endpoints

### Kullanıcı API
- `POST /api/user` - Yeni kullanıcı oluştur
- `GET /api/user/:userId` - Kullanıcı bilgisi al
- `PUT /api/user/:userId` - Kullanıcı bilgisi güncelle
- `POST /api/user/:userId/weight` - Kilo kaydet
- `GET /api/user/:userId/weight-history` - Kilo geçmişi

### Gıda API
- `GET /api/food` - Gıda listesi (arama destekli)
- `GET /api/food/:name` - Gıda detayları
- `POST /api/food/calculate` - Kalori hesapla

### Yemek API
- `POST /api/meals` - Yemek oluştur
- `GET /api/meals/user/:userId` - Kullanıcının yemekleri
- `POST /api/meals/:mealId/items` - Yemeğe gıda ekle
- `GET /api/meals/summary/:userId` - Günlük özet

## 🎯 Nasıl Kullanılır?

### 1. Profil Oluştur
- Adınız, yaşınız, boyunuz, kilonuz ve hedeflerinizi girin
- Sistem otomatik olarak günlük kalori hedefini hesaplar

### 2. Yemek Ekle
- "Beslenme Takibi" sayfasında yemek türünü seçin
- Yediklerinizi arayın ve ekleyin
- Kaloriler otomatik hesaplanır

### 3. İstatistikleri Takip Et
- "İstatistikler" sayfasında haftalık ve aylık trendleri görün
- Beslenme alışkanlıklarınızı analiz edin

### 4. Profil Güncelleyin
- Kilo değişimlerini kaydedin
- Hedeflerinizi güncelleyin

## 📊 Gıda Veritabanı

Uygulama 30+ Türk ve uluslararası gıdayı içermektedir:

- **Et & Balık**: Tavuk, balık, somon, vb.
- **Tahıllar**: Ekmek, pirinç, makarna
- **Sebzeler**: Domates, salata, patates, havuç, vb.
- **Meyveler**: Elma, muz, portakal, çilek, üzüm
- **Süt Ürünleri**: Süt, peynir, yoğurt
- **Baklagiller**: Fasulye, nohut
- **Yağlar & Yemişler**: Zeytinyağı, badem, yer fıstığı
- **İçecekler**: Kahve, çay, meyve suyu

## ⚙️ Özelleştirme

### Gıda Veritabanını Genişlet
`server/foodDatabase.js` dosyasındaki `FOOD_DATABASE` dizisine yeni gıdalar ekleyin:

```javascript
{
  name: 'Gıda Adı',
  calories_per_100g: 150,
  protein: 20,
  carbs: 10,
  fat: 5,
  category: 'Kategori',
  description: 'Açıklama'
}
```

## 🔒 Güvenlik Notları

- Uygulama yerel olarak çalışır
- Veriler SQLite veritabanında saklanır
- Paylaşılan cihazlarda "Çıkış" butonunu kullanın

## 🐛 Sorun Giderme

### Server başlamıyor
```bash
# Proje dizinine girin
cd c:\Users\sthak\OneDrive\Desktop\HakkiTaygun\HakkiTaygun\src\dropnumbergame\diet-tracker-app

# Bağımlılıkları yükleyin
npm install

# Server'ı çalıştırın
npm run server
```

### Port zaten kullanılıyor
Server port 5000, client port 3000 kullanır. Eğer bu portlar meşgulse, `server/index.js` dosyasında PORT değerini değiştirin.

### Veritabanı hataları
Veritabanını sıfırlamak için `diet_tracker.db` dosyasını silin ve uygulamayı yeniden başlatın.

## 📝 Geliştirme Talimatları

### Yeni Özellik Ekleme

1. Backend API'sini `server/routes/` klasöründe ekleyin
2. Frontend komponentini `client/src/components/` klasöründe ekleyin
3. API çağrılarını yapın
4. Stilleri ekleyin

### Veritabanında Tablo Ekleme

`server/database.js` dosyasında `initializeDatabase` fonksiyonuna tablo ekleyin.

## 📞 Destek

Herhangi bir sorun için:
1. Hata mesajını kontrol edin
2. Browser console'unu (F12) kontrol edin
3. Server logs'unu kontrol edin

## 📄 Lisans

Bu proje kişisel kullanım için tasarlanmıştır.

## 🚀 Gelecek Planları

- [ ] Gıda fotoğrafı tanıma
- [ ] Mobil uygulama (React Native)
- [ ] Cloud depolama
- [ ] Sosyal paylaşım özellikleri

---

**Sağlıklı yaşamlar dilerim!** 💚🥗
