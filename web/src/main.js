// 入口文件 - 初始化應用
// PDF Noteshrink Web - 瀏覽器版本
// Version: 1.0.0
// License: MIT

import { isPDF, isImage, pdfToImages, loadImage } from './pdf-handler.js';
import { processImages } from './image-processor.js';
import { exportResults, downloadBlob, generateFilename, estimateOutputSizePreflight } from './export.js';

// 將由其他模組填充
let state = {
    files: [],
    inputImages: [],    // 從 PDF 或圖片轉換後的圖片
    processedImages: [],
    outputBlob: null,
};

// DOM 元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const imagePreviewSection = document.getElementById('imagePreviewSection');
const imagePreviewGrid = document.getElementById('imagePreviewGrid');
const estimateBtn = document.getElementById('estimateBtn');
const processBtn = document.getElementById('processBtn');
const downloadBtn = document.getElementById('downloadBtn');
const logBox = document.getElementById('logBox');
const clearLogBtn = document.getElementById('clearLogBtn');
const outputPreviewSection = document.getElementById('outputPreviewSection');
const outputPreviewGrid = document.getElementById('outputPreviewGrid');
const previewModal = document.getElementById('previewModal');
const modalImage = document.getElementById('modalImage');
const modalCaption = document.getElementById('modalCaption');
const modalClose = document.getElementById('modalClose');

// 參數控制元素
const dpiInput = document.getElementById('dpi');
const numColorsInput = document.getElementById('numColors');
const valueThresholdInput = document.getElementById('valueThreshold');
const satThresholdInput = document.getElementById('satThreshold');
const sampleFractionInput = document.getElementById('sampleFraction');
const saturateCheckbox = document.getElementById('saturate');
const globalPaletteCheckbox = document.getElementById('globalPalette');
const whiteBgCheckbox = document.getElementById('whiteBg');
const outputFormatSelect = document.getElementById('outputFormat');

// 更新顯示值的函數
function updateParamDisplay(input, displayId) {
    const display = document.getElementById(displayId);
    if (display) {
        display.textContent = input.value;
    }
}

// 綁定參數更新
dpiInput.addEventListener('input', () => updateParamDisplay(dpiInput, 'dpiValue'));
numColorsInput.addEventListener('input', () => updateParamDisplay(numColorsInput, 'numColorsValue'));
valueThresholdInput.addEventListener('input', () => updateParamDisplay(valueThresholdInput, 'valueThresholdValue'));
satThresholdInput.addEventListener('input', () => updateParamDisplay(satThresholdInput, 'satThresholdValue'));
sampleFractionInput.addEventListener('input', () => updateParamDisplay(sampleFractionInput, 'sampleFractionValue'));

// 日誌函數
function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString('zh-TW');
    entry.textContent = `[${timestamp}] ${message}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
}

// 清除日誌
clearLogBtn.addEventListener('click', () => {
    logBox.innerHTML = '';
    addLog('日誌已清除', 'info');
});

// Modal 事件
modalClose.addEventListener('click', () => {
    previewModal.style.display = 'none';
});

previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
        previewModal.style.display = 'none';
    }
});

// Escape 鍵關閉 Modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewModal.style.display === 'block') {
        previewModal.style.display = 'none';
    }
});

// 上傳區域事件
uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files));

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFileSelect(e.dataTransfer.files);
});

// 處理文件選擇
function handleFileSelect(files) {
    state.files = Array.from(files);
    
    addLog(`已選擇 ${state.files.length} 個檔案`, 'success');
    
    // 顯示文件列表
    filePreview.innerHTML = '';
    imagePreviewGrid.innerHTML = '';
    let totalSize = 0;
    
    state.files.forEach((file, index) => {
        totalSize += file.size;
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileName = file.name;
        const fileSize = (file.size / 1024 / 1024).toFixed(2);
        
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-name">${fileName}</div>
                <div class="file-size">${fileSize} MB</div>
            </div>
            <button onclick="removeFile(${index})">移除</button>
        `;
        
        filePreview.appendChild(fileItem);
        
        addLog(`✓ ${fileName} (${fileSize} MB)`, 'info');
        
        // 添加圖片預覽
        if (isImage(file)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'image-preview-item';
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <div class="preview-label">${fileName}</div>
                `;
                imagePreviewGrid.appendChild(previewItem);
                // 顯示預覽區域
                imagePreviewSection.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else if (isPDF(file)) {
            // PDF 文件預覽第一頁
            pdfToImages(file, 1).then(images => {
                if (images.length > 0) {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'image-preview-item';
                    previewItem.innerHTML = `
                        <img src="${images[0]}" alt="PDF Preview">
                        <div class="preview-label">📄 ${fileName}</div>
                    `;
                    imagePreviewGrid.appendChild(previewItem);
                    // 顯示預覽區域
                    imagePreviewSection.style.display = 'block';
                }
            }).catch(err => {
                addLog(`PDF 預覽失敗: ${fileName}`, 'warning');
            });
        }
    });
    
    // 立即顯示預覽區域（即使圖片還在載入）
    if (state.files.some(f => isImage(f) || isPDF(f))) {
        imagePreviewSection.style.display = 'block';
    } else {
        imagePreviewSection.style.display = 'none';
    }
    
    // 檢查文件大小
    const totalSizeMB = totalSize / 1024 / 1024;
    if (totalSizeMB > 50) {
        addLog(`⚠️ 檔案總大小 ${totalSizeMB.toFixed(2)} MB 超過 50 MB 限制！`, 'warning');
        state.files = [];
        filePreview.innerHTML = '';
        imagePreviewGrid.innerHTML = '';
        imagePreviewSection.style.display = 'none';
        return;
    }
    
    addLog(`檔案總大小: ${totalSizeMB.toFixed(2)} MB`, 'info');
    processBtn.disabled = false;
    estimateBtn.disabled = false;
}

// 移除檔案
window.removeFile = function(index) {
    state.files.splice(index, 1);
    addLog(`已移除檔案`, 'info');
    
    // 重新渲染
    if (state.files.length === 0) {
        filePreview.innerHTML = '';
        imagePreviewGrid.innerHTML = '';
        imagePreviewSection.style.display = 'none';
        processBtn.disabled = true;
        estimateBtn.disabled = true;
        addLog('請選擇檔案', 'warning');
    } else {
        handleFileSelect(state.files);
    }
};

// 處理按鈕
processBtn.addEventListener('click', startProcessing);
estimateBtn.addEventListener('click', estimateOnly);

/**
 * 只做容量預估（不執行 noteshrink 處理）
 */
async function estimateOnly() {
    if (state.files.length === 0) {
        addLog('請先選擇檔案', 'warning');
        return;
    }

    estimateBtn.disabled = true;
    addLog('================================', 'progress');
    addLog('🔎 開始預估最終輸出大小（不處理圖像）...', 'progress');

    try {
        // 準備影像：若已有 inputImages 可直接用；否則做輕量轉換供預估用
        let imageInfos = state.inputImages;
        if (!imageInfos || imageInfos.length === 0) {
            imageInfos = await convertFilesToImagesForPreflight(state.files);
        }

        const preOptions = {
            numColors: parseInt(numColorsInput.value),
            valueThreshold: parseFloat(valueThresholdInput.value),
            satThreshold: parseFloat(satThresholdInput.value),
            sampleFraction: parseFloat(sampleFractionInput.value) / 100,
        };
        const format = outputFormatSelect.value;
        const est = await estimateOutputSizePreflight(imageInfos, preOptions, { format, jpgQuality: 0.9 });
        const totalMB = (est.totalBytes / 1024 / 1024).toFixed(2);
        addLog(`📐 預估總大小: ~${totalMB} MB`, 'success');
        if (est.perPage && est.perPage.length > 1) {
            const avgMB = ((est.perPage.reduce((a,b)=>a+b,0) / est.perPage.length) / 1024 / 1024).toFixed(2);
            addLog(`  平均每頁: ~${avgMB} MB（估算）`, 'info');
        }
        addLog('（注意：此為快速抽樣估算，實際結果可能因內容及容器開銷而有差異）', 'info');
    } catch (e) {
        addLog(`預估大小失敗: ${e.message}`, 'error');
    } finally {
        estimateBtn.disabled = false;
    }
}

async function startProcessing() {
    if (state.files.length === 0) {
        addLog('請先選擇檔案', 'error');
        return;
    }
    
    processBtn.disabled = true;
    downloadBtn.style.display = 'none';
    addLog('================================', 'progress');
    addLog('🚀 開始處理...', 'progress');
    
    try {
        // Step 1: 轉換檔案為圖片
        await convertFilesToImages();
        
        // Step 1.5: 處理前預估輸出大小
        try {
            addLog('🔎 正在預估最終輸出大小（快速抽樣）...', 'progress');
            const preOptions = {
                numColors: parseInt(numColorsInput.value),
                valueThreshold: parseFloat(valueThresholdInput.value),
                satThreshold: parseFloat(satThresholdInput.value),
                sampleFraction: parseFloat(sampleFractionInput.value) / 100,
            };
            const format = outputFormatSelect.value;
            const est = await estimateOutputSizePreflight(state.inputImages, preOptions, { format, jpgQuality: 0.9 });
            const totalMB = (est.totalBytes / 1024 / 1024).toFixed(2);
            addLog(`📐 預估總大小: ~${totalMB} MB`, 'info');
            if (est.perPage && est.perPage.length > 1) {
                const avgMB = ((est.perPage.reduce((a,b)=>a+b,0) / est.perPage.length) / 1024 / 1024).toFixed(2);
                addLog(`  平均每頁: ~${avgMB} MB（估算）`, 'info');
            }
        } catch (e) {
            addLog(`預估大小失敗（將直接進行處理）: ${e.message}`, 'warning');
        }

        // Step 2: 套用 noteshrink 算法
        await processImagesWithNoteshrink();
        
        // Step 3: 導出結果
        await exportProcessedImages();
        
        addLog('================================', 'progress');
        addLog('✅ 全部完成！', 'success');
        
    } catch (error) {
        addLog(`❌ 錯誤: ${error.message}`, 'error');
    } finally {
        processBtn.disabled = false;
    }
}

/**
 * 將上傳的檔案 (PDF 或圖片) 轉換為圖片陣列
 */
async function convertFilesToImages() {
    addLog('===== Step 1: 檔案轉換 =====', 'progress');
    
    state.inputImages = [];
    
    for (let i = 0; i < state.files.length; i++) {
        const file = state.files[i];
        addLog(`處理 ${i + 1}/${state.files.length}: ${file.name}`, 'info');
        
        try {
            if (isPDF(file)) {
                // PDF 轉圖片
                addLog('  轉換 PDF...', 'progress');
                const images = await pdfToImages(file, parseInt(dpiInput.value), (current, total) => {
                    addLog(`  第 ${current}/${total} 頁`, 'progress');
                });
                state.inputImages.push(...images);
                addLog(`  ✓ PDF 轉換完成 (${images.length} 頁)`, 'success');
                
            } else if (isImage(file)) {
                // 直接載入圖片
                addLog('  載入圖片...', 'progress');
                const imageData = await loadImage(file);
                state.inputImages.push(imageData);
                const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
                addLog(`  ✓ 圖片載入完成 (原${fileSizeMB} MB, ${imageData.width}x${imageData.height}px)`, 'success');
                
            } else {
                addLog(`  ✗ 不支持的檔案類型: ${file.type}`, 'warning');
            }
        } catch (error) {
            addLog(`  ✗ 錯誤: ${error.message}`, 'error');
            throw error;
        }
    }
    
    addLog(`✓ 總共轉換 ${state.inputImages.length} 個圖片`, 'success');
    
    // 顯示第一頁預覽
    if (state.inputImages.length > 0) {
        addLog('  顯示第一頁預覽...', 'info');
        // 預覽實現將在後期功能中添加
    }
}

/**
 * 用於預估的輕量轉圖（不改動全域 state），盡量降低成本
 * - 對 PDF：採用低 DPI（例如 72）轉成影像
 * - 對圖片：直接載入即可（預估流程會再縮圖）
 */
async function convertFilesToImagesForPreflight(files) {
    const results = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            if (isPDF(file)) {
                const lowDpi = 72; // 輕量預估
                const images = await pdfToImages(file, lowDpi);
                // 直接加入（不改變 state）
                results.push(...images);
            } else if (isImage(file)) {
                const imageData = await loadImage(file);
                results.push(imageData);
            }
        } catch (err) {
            addLog(`預估用轉換失敗: ${file.name} - ${err.message}`, 'warning');
        }
    }
    if (results.length === 0) {
        addLog('找不到可用於預估的頁面/圖片', 'warning');
    }
    return results;
}

/**
 * 使用 noteshrink 算法處理圖片
 */
async function processImagesWithNoteshrink() {
    addLog('===== Step 2: Noteshrink 處理 =====', 'progress');
    
    // 收集選項
    const options = {
        numColors: parseInt(numColorsInput.value),
        valueThreshold: parseFloat(valueThresholdInput.value),
        satThreshold: parseFloat(satThresholdInput.value),
        sampleFraction: parseFloat(sampleFractionInput.value) / 100,
        saturate: saturateCheckbox.checked,
        globalPalette: globalPaletteCheckbox.checked,
        whiteBg: whiteBgCheckbox.checked,
    };
    
    addLog(`📊 參數設定:`, 'info');
    addLog(`  色彩數: ${options.numColors}`, 'info');
    addLog(`  取樣比例: ${(options.sampleFraction * 100).toFixed(1)}%`, 'info');
    addLog(`  全域調色板: ${options.globalPalette ? '✓' : '✗'}`, 'info');
    
    try {
        // 處理圖片
        state.processedImages = await processImages(state.inputImages, options, (current, total, msg) => {
            updateProgress(current, total);
            addLog(`  ${msg}`, 'progress');
        });
        
        addLog(`✓ 處理完成: ${state.processedImages.length} 個圖片`, 'success');
        
    } catch (error) {
        addLog(`✗ 處理失敗: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * 導出處理後的圖片
 */
async function exportProcessedImages() {
    addLog('===== Step 3: 導出結果 =====', 'progress');
    
    if (state.processedImages.length === 0) {
        addLog('沒有要導出的圖片', 'error');
        return;
    }
    
    const format = outputFormatSelect.value;
    addLog(`📤 導出格式: ${format.toUpperCase()}`, 'info');
    
    try {
        // 導出
        const blob = await exportResults(state.processedImages, { format });
        state.outputBlob = blob;
        
        const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
        addLog(`✓ 導出成功 (${sizeMB} MB)`, 'success');
        
        // 顯示預覽和下載按鈕
        displayOutputPreview(state.processedImages);
        downloadBtn.style.display = 'inline-block';
        
    } catch (error) {
        addLog(`✗ 導出失敗: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * 顯示輸出預覽
 */
function displayOutputPreview(processedImages) {
    outputPreviewGrid.innerHTML = '';
    
    processedImages.slice(0, 12).forEach((imgInfo, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'output-preview-item';
        
        // 使用 processedImages 中的圖片數據
        const canvas = document.createElement('canvas');
        canvas.width = imgInfo.imageInfo.width;
        canvas.height = imgInfo.imageInfo.height;
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        
        // 將 labels 和 palette 轉換回像素
        const palette = imgInfo.palette;
        for (let i = 0; i < imgInfo.labels.length; i++) {
            const colorIdx = imgInfo.labels[i] * 3;
            imageData.data[i * 4] = palette[colorIdx];
            imageData.data[i * 4 + 1] = palette[colorIdx + 1];
            imageData.data[i * 4 + 2] = palette[colorIdx + 2];
            imageData.data[i * 4 + 3] = 255;
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        previewItem.innerHTML = `
            <img src="${canvas.toDataURL()}" alt="Page ${index + 1}">
            <div class="preview-label">第 ${index + 1} 頁</div>
        `;
        
        // 點擊放大預覽
        previewItem.addEventListener('click', () => {
            modalImage.src = canvas.toDataURL();
            modalCaption.textContent = `第 ${index + 1} 頁 - ${(canvas.width)}x${(canvas.height)} px`;
            previewModal.style.display = 'flex';
        });
        
        outputPreviewGrid.appendChild(previewItem);
    });
    
    if (processedImages.length > 12) {
        const moreItem = document.createElement('div');
        moreItem.className = 'output-preview-item';
        moreItem.style.opacity = '0.6';
        moreItem.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">+${processedImages.length - 12} 更多</div>`;
        outputPreviewGrid.appendChild(moreItem);
    }
    
    outputPreviewSection.style.display = 'block';
}

/**
 * 更新進度條
 */
function updateProgress(current, total) {
    const percentage = Math.round((current / total) * 100);
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressFill.style.width = percentage + '%';
    progressText.textContent = `進度: ${percentage}%`;
}

// 初始化日誌
addLog('應用已就緒 - 請選擇 PDF 或圖片檔案', 'success');
addLog('系統信息: ' + navigator.userAgent.split(' ').slice(-2).join(' '), 'info');

// 下載按鈕事件
downloadBtn.addEventListener('click', () => {
    if (!state.outputBlob) {
        addLog('沒有可下載的檔案', 'warning');
        return;
    }
    
    const format = outputFormatSelect.value;
    const filename = generateFilename(format);
    downloadBlob(state.outputBlob, filename);
    addLog(`✓ 已下載: ${filename}`, 'success');
});

export { state, addLog, convertFilesToImages };
