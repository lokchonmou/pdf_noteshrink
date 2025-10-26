# 部署指南 - PDF Noteshrink Web

## 快速概述

**只需上傳 `dist/` 文件夾內容到 GitHub Pages 或其他靜態主機即可！**

❌ **不需要上傳**: 整個 `web/` 文件夾、`src/` 源碼、`node_modules/`
✅ **只需上傳**: `dist/` 文件夾內的所有文件

---

## 部署方案 1: GitHub Pages (推薦) 🌐

### 方案 A: 使用 GitHub Actions (自動化)

1. **修改 `vite.config.js`** (已預配置):
```javascript
export default {
  base: './',  // 相對路徑，適配子目錄部署
}
```

2. **在 GitHub 上建立倉庫**:
   - 倉庫名: `pdf_noteshrink` 或其他名稱
   - 設置 Pages: Settings → Pages → Deploy from branch

3. **建立 `.github/workflows/deploy.yml`**:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: cd web && npm install
      
      - name: Build
        run: cd web && npm run build
      
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./web/dist
```

4. **提交推送**:
```bash
git add .
git commit -m "Add CI/CD deployment"
git push origin main
```

5. **訪問**:
   - `https://yourusername.github.io/pdf_noteshrink`

### 方案 B: 手動上傳 (簡單)

1. **本地構建**:
```bash
cd web
npm install
npm run build
```

2. **複製 `dist/` 文件夾**:
```bash
# 在 GitHub 網站上
# 進入 Settings → Pages
# 選擇 "Deploy from a branch"
# 設置為 main 分支
```

3. **上傳 `dist/` 文件夾**:
   - 使用 GitHub Desktop 或命令行
   - 只上傳 `dist/` 中的文件到根目錄

4. **訪問**:
   - `https://yourusername.github.io/`

---

## 部署方案 2: Netlify 🚀

最簡單，自動化，推薦！

1. **登錄 Netlify**: https://app.netlify.com

2. **連接 GitHub**:
   - Click "New site from Git"
   - 選擇 GitHub
   - 授權並選擇倉庫

3. **配置構建設置**:
   - Build command: `cd web && npm install && npm run build`
   - Publish directory: `web/dist`

4. **部署**:
   - 每次推送會自動觸發部署
   - 訪問自動生成的 URL

---

## 部署方案 3: Vercel 🔥

1. **登錄 Vercel**: https://vercel.com

2. **導入項目**:
   - Click "Add New..." → "Project"
   - 選擇 GitHub 倉庫

3. **配置**:
   - Framework: "Other"
   - Build Command: `cd web && npm install && npm run build`
   - Output Directory: `web/dist`

4. **部署**:
   - 自動化部署
   - 生成 URL: `https://pdf-noteshrink.vercel.app`

---

## 部署方案 4: 自托管服務器 🖥

### Nginx 配置

1. **複製 `dist/` 到服務器**:
```bash
scp -r dist/ user@server:/var/www/pdf-noteshrink/
```

2. **配置 Nginx** (`/etc/nginx/sites-available/pdf-noteshrink`):
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    root /var/www/pdf-noteshrink;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 緩存設置
    location ~* \.(js|css|jpg|png|gif)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

3. **啟用配置**:
```bash
sudo ln -s /etc/nginx/sites-available/pdf-noteshrink /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Apache 配置

1. **複製 `dist/`**:
```bash
scp -r dist/* user@server:/var/www/html/pdf-noteshrink/
```

2. **配置 `.htaccess`** (放在 `dist/` 中):
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [QSA,L]
</IfModule>

# 緩存
<FilesMatch "\.(jpg|jpeg|png|gif|js|css|swf)$">
  Header set Cache-Control "max-age=2592000"
</FilesMatch>
```

---

## 預部署檢查清單 ✅

在部署之前，確保：

- [x] 移除所有 console.log 調試輸出 ✓
- [x] 添加版本信息 ✓
- [x] 添加版權信息 ✓
- [x] 添加 LICENSE 文件 ✓
- [x] 更新 README.md ✓
- [x] 測試所有輸入格式 (PDF/JPG/PNG)
- [x] 測試輸出格式 (PNG/JPG/PDF)
- [x] 測試多頁 PDF
- [x] 檢查 vite.config.js 的 base 設置
- [x] 構建生產版本: `npm run build`
- [x] 本地測試打包: 用瀏覽器打開 `dist/index.html`

---

## 部署後驗證 🔍

1. **測試基本功能**:
   - 上傳 JPG/PDF
   - 處理圖片
   - 下載結果

2. **檢查控制台**:
   - F12 打開開發者工具
   - 應無錯誤信息
   - 無敏感數據洩漏

3. **檢查性能**:
   - 首頁加載 < 2 秒
   - 圖片處理 < 5 秒
   - PDF 下載順利

---

## 常見問題 ❓

**Q: 為什麼要用相對路徑 (`base: './'`)?**
A: 支持子目錄部署，例如 `yourdomain.com/pdf-noteshrink`

**Q: 我可以同時部署到多個平台嗎?**
A: 可以，同一個 `dist/` 文件夾可部署到任何地方。

**Q: 更新後多久才能看到?**
A: 取決於平台:
- GitHub Pages: 1-5 分鐘
- Netlify: 1-2 分鐘
- Vercel: 30 秒
- 自托管: 立即 (清除瀏覽器緩存)

**Q: 我應該上傳 `node_modules/` 嗎?**
A: 不，只上傳 `dist/` 文件夾。

**Q: dist 文件夾在哪裡?**
A: 執行 `npm run build` 後會生成在 `web/dist/`

---

## 備份和更新 📦

### 更新部署

1. 修改源碼 (`web/src/`)
2. 本地測試: `npm run dev`
3. 構建: `npm run build`
4. 測試打包: 用瀏覽器打開 `dist/index.html`
5. 提交並推送

```bash
git add .
git commit -m "Update features"
git push origin main
```

### 回滾版本

1. 使用 GitHub/Netlify 的發佈歷史
2. 或保存 `dist/` 的備份
3. 或使用 Git 標籤:
```bash
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
```

---

## 文件大小優化 📉

構建後的 `dist/` 文件大小:
- `index.html`: ~10 KB
- `index-*.js`: ~300 KB
- `style-*.css`: ~50 KB
- **總計**: ~360 KB

---

**版本**: 1.0.0
**最後更新**: 2025年10月26日
