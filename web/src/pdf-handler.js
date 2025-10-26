/**
 * PDF 處理模組
 * 使用 pdfjs-dist 將 PDF 轉換為圖片
 * Version: 1.0.0
 * License: MIT
 */

import * as pdfjsLib from 'pdfjs-dist';

// 設置 Worker 路徑
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * 判斷是否為 PDF 檔案
 */
export function isPDF(file) {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * 判斷是否為圖片檔案
 */
export function isImage(file) {
    return file.type.startsWith('image/');
}

/**
 * 將 PDF 轉換為圖片陣列
 * @param {File} pdfFile - PDF 檔案
 * @param {number} dpi - 解析度 (預設 150)
 * @param {Function} onProgress - 進度回調函數 (current, total)
 * @returns {Promise<Array<{canvas, image, page}>>} 圖片陣列
 */
export async function pdfToImages(pdfFile, dpi = 150, onProgress = null) {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const images = [];
    const zoom = dpi / 72; // PDF 預設 DPI 為 72
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: zoom });
            
            // 建立 Canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // 渲染頁面
            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;
            
            // 轉換為圖片
            const imageData = canvas.toDataURL('image/png');
            
            images.push({
                canvas: canvas,
                image: imageData,
                page: pageNum,
                width: canvas.width,
                height: canvas.height,
            });
            
            if (onProgress) {
                onProgress(pageNum, pdf.numPages);
            }
        } catch (error) {
            throw new Error(`PDF 頁面 ${pageNum} 轉換失敗: ${error.message}`);
        }
    }
    
    return images;
}

/**
 * 載入圖片檔案為 ImageData
 * @param {File} imageFile - 圖片檔案
 * @returns {Promise<{image, width, height, page}>}
 */
export async function loadImage(imageFile) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                resolve({
                    image: canvas.toDataURL('image/png'),
                    width: img.width,
                    height: img.height,
                    page: 1,
                });
            };
            img.onerror = () => reject(new Error('圖片載入失敗'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('檔案讀取失敗'));
        reader.readAsDataURL(imageFile);
    });
}

/**
 * 將圖片資料轉換為 ImageData (用於圖片處理)
 * @param {string} dataUrl - Data URL 格式的圖片
 * @returns {Promise<{data: Uint8ClampedArray, width, height}>}
 */
export async function imageDataFromDataUrl(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            resolve({
                data: imageData.data,
                width: canvas.width,
                height: canvas.height,
                imageData: imageData,
            });
        };
        img.src = dataUrl;
    });
}

/**
 * 從 ImageData 建立 Data URL
 * @param {Uint8ClampedArray} data - 圖片資料
 * @param {number} width - 寬度
 * @param {number} height - 高度
 * @returns {string} Data URL
 */
export function dataUrlFromImageData(data, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(data);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
}

/**
 * 取得檔案的 DPI 資訊 (如果可用)
 */
export async function getImageDPI(file) {
    // 簡單實現 - 實際應用中可能需要讀取 EXIF 資訊
    return { x: 150, y: 150 };
}
