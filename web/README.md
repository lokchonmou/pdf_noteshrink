# PDF Noteshrink Web

🚀 **掃描筆記壓縮工具** - 在瀏覽器中本地處理 PDF 和圖片


## 功能特性 ✨

- 📄 **支持多種格式**: PDF、JPG、PNG、GIF
- 🎨 **智能色彩量化**: 使用 noteshrink 算法進行色彩優化
- 🚀 **高效壓縮**: 
  - 85 KB JPG → 47 KB PNG → 51 KB PDF
  - 比原始 PDF 壓縮 98%+
- � **隱私保護**: 所有處理都在瀏覽器中本地進行，無任何資料上傳
- ⚙️ **可調參數**:
  - 色彩數量（2-256 色）
  - DPI 分辨率
  - 背景檢測閾值
  - 飽和度調整
- 📊 **實時預覽**: 輸入和輸出圖片預覽
- 🌙 **深色模式**: 舒適的深色主題 UI

## 技術棧 🛠

- **前端框架**: Vanilla JavaScript ES6 Module
- **構建工具**: Vite 5.4.21
- **核心庫**:
  - `pdfjs-dist` - PDF 轉換
  - `jsPDF` - PDF 生成
  - `ml-matrix` - 矩陣運算
- **算法**: noteshrink 色彩量化 + K-means++ 聚類

## 快速開始 🚀

### 方式 1: 直接打開 (最簡單)
1. 打開 `dist/index.html` 在瀏覽器中
2. 或部署 `dist/` 文件夾到 GitHub Pages/靜態主機
3. 無需任何額外設置

### 方式 2: 本地開發

```bash
cd web
npm install
npm run dev
```

訪問 `http://localhost:5173`

### 生產構建

```bash
npm run build
```

生成 `dist/` 文件夾

## 使用方法 📖

### 步驟 1: 上傳檔案
- 拖拽或選擇 PDF/圖片
- 支持批量上傳多個文件
- 檔案大小限制: 50 MB

### 步驟 2: 調整參數

| 參數 | 預設值 | 範圍 | 說明 |
|------|-------|------|------|
| DPI | 150 | 72-300 | 掃描解析度 |
| 色彩數 | 8 | 2-256 | 調色板大小 |
| 亮度閾值 | 0.25 | 0-1 | 背景檢測 |
| 飽和度閾值 | 0.20 | 0-1 | 前景檢測 |
| 取樣比例 | 5% | 1-20% | 速度和質量平衡 |
| 全域調色板 | 否 | - | 多頁文件用同一調色板 |

### 步驟 3: 處理和下載
- 點擊「開始處理」
- 查看實時進度日誌
- 預覽輸出結果
- 下載為 PNG、JPG 或 PDF



## 文件結構 📁

```
dist/
├── index.html          # 主頁面
├── style-*.css         # 樣式表
├── index-*.js          # 打包後的 JavaScript
└── ...                # 其他資源

web/src/               # 源碼 (開發用)
├── main.js            # 應用入口
├── pdf-handler.js     # PDF 處理
├── image-processor.js # 圖片處理
├── noteshrink.js      # 算法實現
├── kmeans.js          # 聚類算法
├── export.js          # 導出功能
└── style.css          # 樣式

package.json           # 項目配置
vite.config.js         # Vite 配置
```

**生產部署只需 `dist/` 文件夾，無需上傳源碼！**

## 性能指標 📊

| 項目 | 數值 |
|------|------|
| 打包大小 | ~500 KB |
| 首屏加載 | < 2 秒 |
| 85 KB 圖片處理 | < 5 秒 |
| PDF 壓縮率 | 98%+ |

## 算法說明 🔬

### Noteshrink 算法

1. **色彩量化**: 將 RGB 色彩空間量化到 6 位/通道
2. **背景檢測**: 基於飽和度和亮度檢測背景色
3. **聚類**: 使用 K-means++ 從前景像素提取調色板
4. **應用**: 將每個像素映射到最近的調色板顏色

### K-means++ 初始化

確保更穩定和一致的聚類結果，避免局部最優

## 常見問題 ❓

**Q: 我的個人資料是否會被上傳？**
A: 絕對不會。所有處理都在您的瀏覽器中本地進行，無任何網絡請求。

**Q: 支持多少頁的 PDF？**
A: 支持任何頁數的 PDF（受瀏覽器內存限制）。

**Q: 可以批量處理嗎？**
A: 可以，一次上傳多個文件。

**Q: 最大文件大小是多少？**
A: 限制為 50 MB，可根據瀏覽器內存調整。

**Q: 為什麼有時候顏色不對？**
A: 調整「亮度閾值」和「飽和度閾值」參數。

## 許可證 📄

MIT License - 詳見 [LICENSE](LICENSE) 文件

```
MIT License

Copyright (c) 2025 PDF Noteshrink Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

## 致謝 🙏

本項目基於 [mzucker/noteshrink](https://github.com/mzucker/noteshrink) 的原始算法開發。

**原作者**: Matt Zucker  
**原始項目**: https://github.com/mzucker/noteshrink

**Web 版本開發者**: LOK CHON MOU  
**版本**: 1.0.0

### 貢獻

本項目將原始的 Python/C++ noteshrink 算法移植為完整的 JavaScript Web 應用，使其可以：
- 直接在瀏覽器中運行，無需安裝任何依賴
- 保留原始算法的核心功能
- 添加現代化的 Web UI 和交互體驗
- 支持多種輸入/輸出格式

特別感謝原作者的卓越算法設計！

---

歡迎提交 Issue 和 Pull Request！

GitHub: [https://github.com/lokchonmou/pdf_noteshrink](https://github.com/lokchonmou/pdf_noteshrink)

---

**版本**: 1.0.0
**開發者**: LOK CHON MOU
**最後更新**: 2025年10月26日
**許可證**: MIT
