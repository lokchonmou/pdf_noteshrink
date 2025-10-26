/**
 * 導出功能 - 將處理結果導出為 PDF 或圖片
 * Version: 1.0.0
 * License: MIT
 */

import jsPDF from 'jspdf';
import { labelsToRGBA, createImageData } from './image-processor.js';

/**
 * 將索引圖和調色板轉換為圖片 Data URL (支持 PNG 或 JPG)
 * @param {Uint8Array} labels - 索引圖
 * @param {Uint8ClampedArray} palette - 調色板
 * @param {number} width
 * @param {number} height
 * @param {string} format - 格式 ('png' 或 'jpeg')，預設 PNG
 * @returns {Promise<string>} Data URL
 */
export async function exportPNG(labels, palette, width, height, format = 'png') {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // DEBUG: 檢查 DPR
        const dpr = window.devicePixelRatio || 1;
        console.log(`[exportPNG] DPR: ${dpr}, Canvas size: ${width}x${height}, Canvas actual size: ${canvas.width}x${canvas.height}`);
        
        const ctx = canvas.getContext('2d');
        const rgba = labelsToRGBA(labels, palette, width, height);
        const imageData = createImageData(rgba, width, height);
        
        ctx.putImageData(imageData, 0, 0);
        
        // 根據格式選擇輸出類型
        let mimeType = 'image/png';
        let quality = 0.95; // JPG 質量
        
        if (format.toLowerCase() === 'jpg' || format.toLowerCase() === 'jpeg') {
            mimeType = 'image/jpeg';
        }
        
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(dataUrl);
    });
}

/**
 * 將 PNG Data URL 轉換為 Blob
 * @param {string} dataUrl
 * @returns {Promise<Blob>}
 */
export function dataUrlToBlob(dataUrl) {
    return new Promise((resolve) => {
        fetch(dataUrl).then(res => res.blob()).then(blob => resolve(blob));
    });
}

/**
 * 組合多個 PNG 圖片為 PDF
 * @param {Array<string>} pngDataUrls - PNG Data URL 陣列
 * @param {Array<number>} widths - 圖片寬度
 * @param {Array<number>} heights - 圖片高度
 * @param {Array<Object>} dpiInfo - DPI 資訊 [{x, y}, ...]
 * @returns {Promise<Blob>} PDF Blob
 */
export async function exportPDF(pngDataUrls, widths, heights, dpiInfo = null) {
    return new Promise(async (resolve) => {
        // 建立 PDF (A4 大小)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        for (let i = 0; i < pngDataUrls.length; i++) {
            // 計算縮放尺寸
            const imgWidth = widths[i];
            const imgHeight = heights[i];
            const dpi = dpiInfo ? dpiInfo[i].x : 150;
            
            // 轉換像素到毫米
            const mmWidth = imgWidth / dpi * 25.4;
            const mmHeight = imgHeight / dpi * 25.4;
            
            // 計算縮放因子以適應頁面
            let scaledWidth = mmWidth;
            let scaledHeight = mmHeight;
            
            if (scaledWidth > pageWidth - 10) {
                const scale = (pageWidth - 10) / scaledWidth;
                scaledWidth *= scale;
                scaledHeight *= scale;
            }
            
            if (scaledHeight > pageHeight - 10) {
                const scale = (pageHeight - 10) / scaledHeight;
                scaledWidth *= scale;
                scaledHeight *= scale;
            }
            
            // 添加圖片到 PDF
            const x = (pageWidth - scaledWidth) / 2;
            const y = (pageHeight - scaledHeight) / 2;
            
            try {
                // 改用 JPG 格式以減小 PDF 大小
                // 先將 PNG 轉換為 JPG
                const jpgDataUrl = await convertPNGtoJPG(pngDataUrls[i], imgWidth, imgHeight);
                
                pdf.addImage(jpgDataUrl, 'JPEG', x, y, scaledWidth, scaledHeight);
            } catch (error) {
                // 如果轉換失敗，回退到原 PNG
                pdf.addImage(pngDataUrls[i], 'PNG', x, y, scaledWidth, scaledHeight);
            }
            
            // 新增頁面 (除了最後一頁)
            if (i < pngDataUrls.length - 1) {
                pdf.addPage();
            }
        }
        
        // 生成 PDF Blob
        const pdfBlob = pdf.output('blob');
        resolve(pdfBlob);
    });
}

/**
 * 將 PNG Data URL 轉換為 JPG Data URL
 */
async function convertPNGtoJPG(pngDataUrl, width, height) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            // 轉換為 JPG (quality 90)
            const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.90);
            resolve(jpgDataUrl);
        };
        img.src = pngDataUrl;
    });
}

/**
 * 將 Blob 下載為檔案
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * 批量導出圖片
 * @param {Array<Object>} processedResults - 處理結果陣列
 * @param {Object} options
 * @returns {Promise<Blob>} 根據 options.format 返回相應 Blob
 */
export async function exportResults(processedResults, options) {
    const { format = 'pdf', outputFormat = 'pdf' } = options;
    const finalFormat = format || outputFormat;
    
    // 生成所有圖片
    const pngDataUrls = [];
    const widths = [];
    const heights = [];
    const dpiInfo = [];
    
    for (const result of processedResults) {
        const { labels, palette, imageInfo } = result;
        
        // 根據最終格式選擇導出格式
        let exportFormat = finalFormat === 'jpg' ? 'jpeg' : 'png';
        
        const imgUrl = await exportPNG(labels, palette, imageInfo.width, imageInfo.height, exportFormat);
        pngDataUrls.push(imgUrl);
        widths.push(imageInfo.width);
        heights.push(imageInfo.height);
        // 對於 PNG/JPG 輸出，不使用 DPI 縮放以保持檔案大小
        dpiInfo.push({ x: 96, y: 96 }); // 螢幕 DPI
    }
    
    // 根據格式導出
    if (finalFormat === 'pdf') {
        // PDF 使用更高的 DPI 以保持質量
        for (let i = 0; i < dpiInfo.length; i++) {
            dpiInfo[i] = { x: 150, y: 150 };
        }
        return await exportPDF(pngDataUrls, widths, heights, dpiInfo);
    } else if (finalFormat === 'png' || finalFormat === 'jpg') {
        // 單張圖片導出 (只返回第一張)
        // 直接轉換為 PNG Blob，不進行任何 DPI 縮放
        const blob = await dataUrlToBlob(pngDataUrls[0]);
        return blob;
    } else {
        throw new Error(`不支持的輸出格式: ${finalFormat}`);
    }
}

/**
 * 生成檔案名稱
 * @param {string} format - 格式 ('pdf', 'png', 'jpg')
 * @returns {string}
 */
export function generateFilename(format = 'pdf') {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    const extensions = {
        'pdf': 'pdf',
        'png': 'png',
        'jpg': 'jpg',
    };
    
    const ext = extensions[format] || 'pdf';
    return `noteshrink_${timestamp}.${ext}`;
}
