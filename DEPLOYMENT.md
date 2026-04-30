# GitHub'a Push Etmek İçin Adımlar

## 1️⃣ GitHub Repo Oluştur

1. GitHub'a git: https://github.com/new
2. Repository name: `diet-tracker-app`
3. Public seç (diğer kullanıcılar görebilsin)
4. Initialize README, .gitignore, license seçme (biz zaten var)
5. "Create repository" tıkla

## 2️⃣ GitHub'a Push Et

```bash
# GitHub'dan aldığın URL'i koy (https://github.com/SENIN_USERNAME/diet-tracker-app.git)
git remote add origin https://github.com/SENIN_USERNAME/diet-tracker-app.git
git branch -M main
git push -u origin main
```

## 3️⃣ Frontend: GitHub Pages Deploy

### Adım A: gh-pages Package Ekle

```bash
cd client
npm install gh-pages --save-dev
```

### Adım B: package.json Güncelle

`client/package.json`'a ekle:

```json
"homepage": "https://SENIN_USERNAME.github.io/diet-tracker-app/",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d build"
}
```

### Adım C: Deploy Et

```bash
npm run deploy
```

### Adım D: GitHub Settings

1. GitHub repo'ya git
2. Settings → Pages
3. Build and deployment → Deploy from a branch
4. Branch: `gh-pages` / `/(root)`
5. Save

**3-5 dakika sonra:** https://SENIN_USERNAME.github.io/diet-tracker-app/ canlı olur

## 4️⃣ Backend: Render Deploy

### Adım A: Render.com'a Kaydol

https://render.com → GitHub ile kaydol

### Adım B: New Web Service

1. Dashboard → New +
2. Web Service
3. Connect repository → diet-tracker-app seç
4. Ayarlar:
   - Name: `diet-tracker-backend`
   - Environment: `Node`
   - Region: `Frankfurt` (EU)
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
   - Auto-deploy: ON

### Adım C: Environment Variables Ekle

Render Dashboard → Environment:
```
DATABASE_URL=postgresql://user:pass@host/db
NODE_ENV=production
```

### Adım D: Deploy

"Deploy" tıkla → 2-3 dakika deploy eder

Sonuç URL: `https://diet-tracker-backend.onrender.com`

## 5️⃣ Frontend Backend URL'sini Güncelle

`client/src/App.js`'de axios'u update et:

```javascript
// Production
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://diet-tracker-backend.onrender.com'
  : 'http://localhost:5000';

axios.defaults.baseURL = API_URL;
```

Sonra push et:
```bash
git add -A
git commit -m "Update API URL for production"
git push
```

Frontend otomatik re-deploy olur (GitHub Pages).

## ✅ Sonuç

- Frontend: https://SENIN_USERNAME.github.io/diet-tracker-app/
- Backend: https://diet-tracker-backend.onrender.com
- Diğer kullanıcılar erişebilir!

---

**Notlar:**
- .env dosyası Git'e push ETME (zaten .gitignore'da var)
- API keys güvenli tut
- Render free tier: 15 dakika idle → sleep mode
- İlk request'de 30sn gecikme olabilir
