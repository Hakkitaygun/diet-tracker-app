# Diyetisyen AI - Proje Özeti

## ✅ Tamamlanan Bileşenler

### Backend (Node.js + Express)
✓ RESTful API ile 20+ endpoint
✓ SQLite veritabanı
✓ 30+ gıda veritabanı
✓ AI destekli tavsiyeler motoru
✓ Beslenme analizi
✓ Kilo ve sağlık metrikleri takibi

### Frontend (React)
✓ 5 ana sayfa/sekme
✓ Responsive tasarım
✓ İstatistik grafikleri
✓ Gerçek zamanlı hesaplamalar
✓ Beautiful modern UI

### Veritabanı
✓ Kullanıcı profilleri
✓ Yemek ve gıda öğeleri
✓ Günlük beslenme özeti
✓ Sağlık metrikleri
✓ Gıda veritabanı

### AI Özellikleri
✓ Kişiselleştirilmiş kalori tavsiyeleri
✓ Makronutrient dağılımı analizi
✓ Beslenme kalite raporu
✓ Yemek önerileri
✓ Haftalık/aylık istatistikler

## 📁 Tüm Dosyalar

```
diet-tracker-app/
├── package.json (root)
├── README.md
├── QUICKSTART.md
├── .gitignore
│
├── server/
│   ├── package.json
│   ├── index.js
│   ├── database.js
│   ├── foodDatabase.js
│   ├── .env
│   └── routes/
│       ├── food.js
│       ├── meals.js
│       ├── ai.js
│       └── user.js
│
└── client/
    ├── package.json
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── index.js
    │   ├── index.css
    │   ├── App.js
    │   ├── App.css
    │   └── components/
    │       ├── Dashboard.js + .css
    │       ├── MealTracker.js + .css
    │       ├── Recommendations.js + .css
    │       ├── Analytics.js + .css
    │       └── UserProfile.js + .css
```

## 🎯 Temel Özellikler

### 1. Profil Yönetimi
- Kişisel bilgi (ad, yaş, kilo, boy)
- Beslenme hedefi seçimi
- Otomatik kalori hedefi hesaplaması
- Kilo takibi

### 2. Yemek Takibi
- 30+ gıda arama
- Otomatik kalori hesaplaması
- Gün içerisinde birden fazla yemek
- Yemek türü kategorileri (Kahvaltı, Öğle, vb)

### 3. AI Tavsiyeleri
- Günlük kalori hedefine göre öneriler
- Beslenme kalitesi analizi
- Makronutrient dengesinde iyileştirmeler
- Yemek kombinasyon önerileri

### 4. İstatistikler
- Haftalık/aylık trend grafikleri
- Kalori alımı grafikleri
- Makronutrient dağılımı
- Kilo değişim takibi

## 🔄 API Mimarisi

```
Client (React)
    ↓
Axios HTTP Requests
    ↓
Express Server (Node.js)
    ↓
SQLite Database
```

## 💾 Veri Akışı

1. **Profil Oluşturma**
   - Kullanıcı bilgileri → Users tablosuna kaydedilir
   - Sistem otomatik kalori hedefi hesaplar

2. **Yemek Ekleme**
   - Gıda seçimi → Meals tablosuna kaydedilir
   - Meal items → Makronutrientler hesaplanır
   - Daily summary → Otomatik güncellenir

3. **Tavsiye Üretimi**
   - Daily summary verisi alınır
   - AI algoritması çalıştırılır
   - Kişiselleştirilmiş öneriler döndürülür

4. **İstatistik**
   - Tarihsel veriler alınır
   - Grafikler çizilir
   - Trendler hesaplanır

## 🚀 Çalıştırma Komutları

### İlk Kurulum
```bash
cd "c:\Users\sthak\OneDrive\Desktop\HakkiTaygun\HakkiTaygun\src\dropnumbergame\diet-tracker-app"
npm install
```

### Geliştirme Modu
```bash
npm run dev
# Açılacak: 
# - Frontend: http://localhost:3000
# - Backend: http://localhost:5000
```

### Sadece Backend
```bash
npm run server
```

### Sadece Frontend
```bash
npm run client
```

## 📊 Veritabanı Şeması

### Users Tablosu
- id (PK)
- name (TEXT)
- age (INTEGER)
- gender (TEXT)
- height (REAL)
- weight (REAL)
- goal (TEXT)
- daily_calorie_goal (INTEGER)

### Meals Tablosu
- id (PK)
- user_id (FK)
- meal_type (TEXT)
- date (DATE)
- created_at (DATETIME)

### Meal Items Tablosu
- id (PK)
- meal_id (FK)
- food_name (TEXT)
- calories (INTEGER)
- protein (REAL)
- carbs (REAL)
- fat (REAL)
- portion_size (TEXT)

### Daily Summary Tablosu
- id (PK)
- user_id (FK)
- date (DATE)
- total_calories (INTEGER)
- total_protein (REAL)
- total_carbs (REAL)
- total_fat (REAL)

## 🛠️ Teknoloji Stack

### Backend
- **Node.js**: Server ortamı
- **Express**: Web framework
- **SQLite3**: Veritabanı
- **Axios**: HTTP requests
- **CORS**: Cross-origin requests

### Frontend
- **React 18**: UI framework
- **Recharts**: Grafikler
- **Axios**: API calls
- **CSS3**: Stil

### Araçlar
- **npm**: Paket yöneticisi
- **Git**: Sürüm kontrolü

## 💡 AI Algoritması

Sistem aşağıdaki faktörleri analiz ederek öneriler üretir:

1. **Kalori Dengesi**
   - Tüketilen vs. Hedef kalori
   - Günün kalan kısmı için öneriler

2. **Makronutrient Dengeleme**
   - Protein oranı kontrolü
   - Karbohidrat dağılımı
   - Yağ oranı analizi

3. **Beslenme Kalitesi**
   - Vitamin ve mineral kaynakları
   - İşlenmiş gıda uyarısı
   - Çeşitlilik tavsiyesi

4. **Kişisel Hedef**
   - Kilo verme: Kalori açığı
   - Kas kazanma: Protein artışı
   - Sağlık: Dengeli beslenme

## 🎨 Renk Paleti

- **Ana Renk**: #667eea (Mor-Mavi)
- **Vurgu Renk**: #764ba2 (Koyu Mor)
- **Başarı**: #4ECDC4 (Turkuaz)
- **Uyarı**: #FFE66D (Sarı)
- **Hata**: #FF6B6B (Kırmızı)

## 🔐 Güvenlik Özellikleri

- ✓ Yerel veri depolama
- ✓ CORS koruması
- ✓ Input doğrulama
- ✓ SQL injection koruması (parametreli sorgular)

## 📱 Responsive Tasarım

- ✓ Desktop (1920px+)
- ✓ Tablet (768px - 1024px)
- ✓ Mobil (< 768px)

## 🚀 Gelecek İyileştirmeler

- [ ] Hızlı yemek veritabanı (popüler yemekler)
- [ ] Tarifler ve hazırlama yönergeleri
- [ ] Alışveriş listesi oluşturma
- [ ] Beslenme uzmanı koçu
- [ ] Sosyal paylaşım
- [ ] Veri dışa aktarma (PDF, Excel)
- [ ] Mobil uygulama (React Native)
- [ ] Cloud senkronizasyonu

## ✅ Test Edilen Özellikler

✓ Profil oluşturma
✓ Yemek ekleme
✓ Kalori hesaplaması
✓ AI tavsiyeleri
✓ İstatistikler
✓ Responsive tasarım
✓ Veritabanı işlemleri

---

**Proje başarıyla tamamlanmıştır!** 🎉
