# Windows Kurulum Kılavuzu - Diyetisyen

Adım adım Windows'ta uygulamayı kurma ve çalıştırma talimatları.

## 📋 Ön Gereksinimler

- Windows 10 veya daha yeni
- Node.js (v14 veya daha yeni)
- npm (Node.js ile birlikte gelir)

## ✅ Node.js Kurulumu

### Adım 1: Node.js İndirin
1. https://nodejs.org/ adresine gidin
2. "LTS" (Long Term Support) versiyonunu indirin
3. İndirilen .msi dosyasını çalıştırın

### Adım 2: Kurulum Sihirbazı
1. "Next" butonuna tıklayın
2. Lisans koşullarını kabul edin ("I accept the terms...")
3. Kurulum konumunu seçin (varsayılan tamam)
4. Özellikleri seçin (hepsi varsayılan olarak seçili)
5. "Install" butonuna tıklayın
6. Kurulum tamamlandıktan sonra Bilgisayarı yeniden başlatın

### Adım 3: Kurulumu Doğrulayın
1. PowerShell açın (Windows + X, PowerShell seçin)
2. Aşağıdaki komutları yazın:
```bash
node --version
npm --version
```
3. Versiyon numaraları görünüyorsa başarılı!

## 🚀 Uygulamayı Kurma

### Adım 1: Proje Klasörüne Git
1. PowerShell açın
2. Bu komutu yazın:
```bash
cd "c:\Users\sthak\OneDrive\Desktop\HakkiTaygun\HakkiTaygun\src\dropnumbergame\diet-tracker-app"
```

### Adım 2: Bağımlılıkları Yükle
Aşağıdaki komutu çalıştırın:
```bash
npm install
```

Bu komutu çalıştırmak 2-5 dakika alabilir. Bekleyin, birçok paket indirilecektir.

**İlerleme İşareti**: Tamamlandığında "added X packages" mesajı göreceksiniz.

## ▶️ Uygulamayı Çalıştırma

### Adım 1: Geliştirme Modu
Aynı PowerShell penceresinde:
```bash
npm run dev
```

### Adım 2: Bekleyin
- "Starting..." mesajı göreceksiniz
- 10-15 saniye bekleyin
- Frontend otomatik açılacak: http://localhost:3000

### Adım 3: Kullan!
1. Profil oluşturun
2. Yemek ekleyin
3. Dashboard ve öğün takibini kullanın

## 🌐 Tarayıcıda Açma

Eğer otomatik açılmadıysa manuel olarak açın:

**Frontend**: http://localhost:3000
**Backend API**: http://localhost:5000

## 🛑 Uygulamayı Durdurma

PowerShell penceresinde:
```bash
Ctrl + C
```

Sorulursa "Y" yazıp Enter tuşuna basın.

## 🔄 Yeniden Başlatma

PowerShell penceresinde:
```bash
npm run dev
```

## 📱 Başka Cihazdan Erişme (İsteğe Bağlı)

Aynı WiFi ağında başka bir bilgisayardan veya telefondan erişmek için:

### Adım 1: Bilgisayarınızın IP Adresini Öğrenin
PowerShell'de:
```bash
ipconfig
```

"IPv4 Address" altındaki 192.168.x.x formatındaki adres bulun.

### Adım 2: Başka Cihazda Erişin
Tarayıcıda:
```
http://192.168.x.x:3000
```

(x.x yerine gerçek IP adresini yazın)

## ⚠️ Sorun Giderme

### Problem: "npm is not recognized"
**Çözüm**: Node.js yüklü değil veya yüklü değil
1. Node.js'i yeniden yükleyin
2. Bilgisayarı yeniden başlatın

### Problem: Port 3000 zaten kullanımda
**Çözüm**: Başka uygulamayı kapat veya başka port kullan
```bash
set PORT=3001 && npm run dev
```

### Problem: Port 5000 zaten kullanımda
**Çözüm**: Server klasöründe PORT'u değiştirin
1. `server/.env` dosyasını açın
2. `PORT=5001` yapın
3. Kaydedip yeniden başlatın

### Problem: "npm install" başarısız
**Çözüm**: 
1. PowerShell'i yönetici olarak açın (Windows + X)
2. Yeniden deneyin

### Problem: Çok yavaş yükleniyor
**Çözüm**:
1. İnternet hızınızı kontrol edin
2. npm cache'i temizleyin:
```bash
npm cache clean --force
```
3. `node_modules` klasörünü silin ve yeniden yükleyin

### Problem: Veritabanı hatası
**Çözüm**:
1. `server/diet_tracker.db` dosyasını silin
2. Uygulamayı yeniden başlatın
3. Veritabanı otomatik oluşturulacaktır

## 🔧 Gelişmiş Komutlar

### Sadece Backend
```bash
npm run server
```

### Sadece Frontend
```bash
npm run client
```

### Backend'i Debug Modunda Çalıştır
```bash
cd server
npm run dev
```

## 📁 Önemli Dosyalar

- `server/.env` - Backend ayarları
- `server/diet_tracker.db` - Veritabanı dosyası
- `client/src/App.js` - Frontend ana dosyası

## 🛡️ Güvenlik Notları

- Uygulamayı yalnızca güvenilir ağlarda paylaşın
- Veritabanını yedekleyin
- Güvenli WiFi kullanın

## 📞 İlave Yardım

Herhangi bir sorun için:
1. PowerShell hatalarını kontrol edin
2. Browser console'u açın (F12) ve hataları görün
3. `README.md` dosyasını okuyun

## ✅ Kontrol Listesi

- [ ] Node.js yüklü mü? (node --version)
- [ ] npm yüklü mü? (npm --version)
- [ ] npm install tamamlandı mı?
- [ ] npm run dev çalışıyor mu?
- [ ] http://localhost:3000 açılıyor mu?
- [ ] Profil oluşturabiliyorum?
- [ ] Yemek ekleyebiliyorum?

Hepsi işaretlendiyse başarılısınız! 🎉

---

**Başarılar!** 🥗💚
