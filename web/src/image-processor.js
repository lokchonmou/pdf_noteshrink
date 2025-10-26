/**
 * 圖片處理管道
 * 將圖片通過 noteshrink 算法進行處理
 */

import {
    samplePixels,
    getPalette,
    applyPalette,
} from './noteshrink.js';
import { imageDataFromDataUrl, dataUrlFromImageData } from './pdf-handler.js';

/**
 * 處理單個圖片
 * @param {Object} imageInfo - 圖片資訊 {image, width, height, page}
 * @param {Uint8ClampedArray} palette - 調色板 (如果為 null 則新建)
 * @param {Object} options - 選項
 * @returns {Promise<{labels, palette, imageInfo}>}
 */
export async function processImage(imageInfo, palette, options) {
    const {
        numColors = 8,
        valueThreshold = 0.25,
        satThreshold = 0.20,
        sampleFraction = 0.05,
        saturate = true,
        whiteBg = false,
    } = options;
    
    // 載入圖片資料
    const imgData = await imageDataFromDataUrl(imageInfo.image);
    
    // 轉換為 Uint8ClampedArray (RGB)
    let rgb = new Uint8ClampedArray(imgData.width * imgData.height * 3);
    let idx = 0;
    
    for (let i = 0; i < imgData.data.length; i += 4) {
        rgb[idx++] = imgData.data[i];       // R
        rgb[idx++] = imgData.data[i + 1];   // G
        rgb[idx++] = imgData.data[i + 2];   // B
        // 跳過 A (alpha)
    }
    
    // 如果沒有調色板，則創建
    if (!palette) {
        // 取樣像素
        const samples = samplePixels(rgb, sampleFraction);
        
        // 獲取調色板
        palette = getPalette(
            samples,
            numColors,
            valueThreshold,
            satThreshold,
            40 // kmeansIter
        );
    }
    
    // 套用調色板
    const labels = applyPalette(rgb, palette, valueThreshold, satThreshold);
    
    // 應用飽和度和白色背景選項
    let finalPalette = palette.slice(); // 複製
    
    if (saturate) {
        finalPalette = saturatePalette(finalPalette);
    }
    
    if (whiteBg) {
        finalPalette[0] = 255;
        finalPalette[1] = 255;
        finalPalette[2] = 255;
    }
    
    return {
        labels,
        palette: finalPalette,
        imageInfo,
    };
}

/**
 * 提升調色板的飽和度
 * @param {Uint8ClampedArray} palette
 * @returns {Uint8ClampedArray}
 */
function saturatePalette(palette) {
    const result = palette.slice();
    
    // 找最小和最大值
    let minVal = 255;
    let maxVal = 0;
    
    for (let i = 0; i < palette.length; i++) {
        minVal = Math.min(minVal, palette[i]);
        maxVal = Math.max(maxVal, palette[i]);
    }
    
    const range = maxVal - minVal;
    
    if (range === 0) {
        return result; // 無法提升
    }
    
    // 應用線性拉伸
    for (let i = 0; i < palette.length; i++) {
        result[i] = Math.round(255 * (palette[i] - minVal) / range);
    }
    
    return result;
}

/**
 * 將索引圖轉換回 RGB 圖片
 * @param {Uint8Array} labels - 索引圖
 * @param {Uint8ClampedArray} palette - 調色板
 * @param {number} width
 * @param {number} height
 * @returns {Uint8ClampedArray} RGBA 圖片資料
 */
export function labelsToRGBA(labels, palette, width, height) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < labels.length; i++) {
        const colorIdx = labels[i];
        const r = palette[colorIdx * 3];
        const g = palette[colorIdx * 3 + 1];
        const b = palette[colorIdx * 3 + 2];
        
        rgba[i * 4] = r;
        rgba[i * 4 + 1] = g;
        rgba[i * 4 + 2] = b;
        rgba[i * 4 + 3] = 255; // Alpha
    }
    
    return rgba;
}

/**
 * 建立 ImageData 物件
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @returns {ImageData}
 */
export function createImageData(data, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(data);
    return imageData;
}

/**
 * 處理多個圖片 (支持全域調色板)
 * @param {Array} imageInfos
 * @param {Object} options
 * @param {Function} onProgress
 * @returns {Promise<Array>}
 */
export async function processImages(imageInfos, options, onProgress = null) {
    const results = [];
    let globalPalette = null;
    
    // Step 1: 如果需要全域調色板，先建立
    if (options.globalPalette) {
        globalPalette = await buildGlobalPalette(imageInfos, options, onProgress);
    }
    
    // Step 2: 處理每個圖片
    for (let i = 0; i < imageInfos.length; i++) {
        const result = await processImage(
            imageInfos[i],
            globalPalette,
            options
        );
        results.push(result);
        
        if (onProgress) {
            onProgress(i + 1, imageInfos.length, `處理第 ${i + 1}/${imageInfos.length} 個圖片`);
        }
    }
    
    return results;
}

/**
 * 建立全域調色板
 * @param {Array} imageInfos
 * @param {Object} options
 * @param {Function} onProgress
 * @returns {Promise<Uint8ClampedArray>}
 */
async function buildGlobalPalette(imageInfos, options, onProgress) {
    const {
        numColors = 8,
        valueThreshold = 0.25,
        satThreshold = 0.20,
        sampleFraction = 0.05,
    } = options;
    
    // 收集所有樣本
    const allSamples = [];
    
    for (let i = 0; i < imageInfos.length; i++) {
        const imgData = await imageDataFromDataUrl(imageInfos[i].image);
        
        // 轉換為 RGB
        let rgb = new Uint8ClampedArray(imgData.width * imgData.height * 3);
        let idx = 0;
        
        for (let j = 0; j < imgData.data.length; j += 4) {
            rgb[idx++] = imgData.data[j];
            rgb[idx++] = imgData.data[j + 1];
            rgb[idx++] = imgData.data[j + 2];
        }
        
        // 取樣
        const samples = samplePixels(rgb, sampleFraction);
        allSamples.push(samples);
        
        if (onProgress) {
            onProgress(i + 1, imageInfos.length, `建立全域調色板: ${i + 1}/${imageInfos.length}`);
        }
    }
    
    // 合併所有樣本
    const totalSize = allSamples.reduce((sum, s) => sum + s.length, 0);
    const mergedSamples = new Uint8ClampedArray(totalSize);
    
    let offset = 0;
    for (const samples of allSamples) {
        mergedSamples.set(samples, offset);
        offset += samples.length;
    }
    
    // 均衡樣本
    const numInputs = imageInfos.length;
    const targetSize = Math.round(totalSize / numInputs);
    let balancedSamples = new Uint8ClampedArray(targetSize * numInputs);
    
    let outIdx = 0;
    for (const samples of allSamples) {
        const step = Math.max(1, Math.floor(samples.length / targetSize));
        for (let i = 0; i < samples.length && outIdx < balancedSamples.length; i += step) {
            balancedSamples[outIdx++] = samples[i];
        }
    }
    
    // 獲取調色板
    const palette = getPalette(
        balancedSamples.slice(0, outIdx),
        numColors,
        valueThreshold,
        satThreshold,
        40
    );
    
    return palette;
}
