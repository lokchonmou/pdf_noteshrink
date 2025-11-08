# PDF Noteshrink Web - GitHub Pages 部署指南

## 自動部署設定

此專案已設定 GitHub Actions 自動部署到 GitHub Pages。

### 如何啟用

1. 前往你的 GitHub repo: `https://github.com/lokchonmou/pdf_noteshrink`
2. 點擊 **Settings** > **Pages**
3. 在 **Build and deployment** 下：
   - Source: 選擇 **GitHub Actions**
4. 儲存設定

### 部署流程

每次 push 到 `main` branch 時：
1. GitHub Actions 會自動執行
2. 安裝依賴 (`npm ci`)
3. 執行 build (`npm run build`)
4. 部署 `web/dist/` 到 GitHub Pages

完成後可在以下網址存取：
- https://lokchonmou.github.io/pdf_noteshrink/

### 本地開發

```bash
# 開發模式（熱更新）
cd web
npm run dev

# 預覽 production build
npm run build
npm run preview
```

### 版本管理

- ✅ **需要 commit**: `web/src/`, `web/index.html`, `web/package.json` 等源碼
- ❌ **不需要 commit**: `web/dist/`（自動 build，已在 `.gitignore`）
- ❌ **不需要 commit**: `web/node_modules/`（已在 `.gitignore`）

### 檔案說明

- `.github/workflows/deploy.yml`: GitHub Actions 自動部署設定
- `web/vite.config.js`: Vite 設定，production build 時會使用 `/pdf_noteshrink/` 作為 base path
- `web/.gitignore`: 排除 `dist/` 和 `node_modules/`
