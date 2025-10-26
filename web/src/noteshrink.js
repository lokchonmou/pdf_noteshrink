/**
 * Noteshrink 核心算法 - JavaScript 版本
 * 從 Python 移植過來
 * 
 * 依賴於 ml-matrix 進行矩陣操作
 */

import { kmeans, vq } from './kmeans.js';

/**
 * 量化圖像 - 減少每個通道的位數
 * @param {Uint8ClampedArray} imageData - RGB 像素資料
 * @param {number} bitsPerChannel - 每通道位數 (預設 6)
 * @returns {Uint8ClampedArray} 量化後的像素資料
 */
export function quantize(imageData, bitsPerChannel = 6) {
    const result = new Uint8ClampedArray(imageData.length);
    const shift = 8 - bitsPerChannel;
    const halfbin = (1 << shift) >> 1;
    
    for (let i = 0; i < imageData.length; i++) {
        result[i] = ((imageData[i] >> shift) << shift) + halfbin;
    }
    
    return result;
}

/**
 * 將 RGB 三元組打包成單個整數
 * @param {Array<number>|Float32Array} rgb - RGB 值陣列 (寬度 x 高度 x 3)
 * @returns {Uint32Array} 打包後的整數
 */
export function packRGB(rgb) {
    const packed = new Uint32Array(rgb.length / 3);
    
    for (let i = 0; i < packed.length; i++) {
        const r = rgb[i * 3] | 0;
        const g = rgb[i * 3 + 1] | 0;
        const b = rgb[i * 3 + 2] | 0;
        packed[i] = ((r << 16) | (g << 8) | b) >>> 0;
    }
    
    return packed;
}

/**
 * 將打包的整數解包成 RGB 三元組
 * @param {Uint32Array} packed - 打包後的整數
 * @returns {Uint8ClampedArray} RGB 值陣列
 */
export function unpackRGB(packed) {
    const rgb = new Uint8ClampedArray(packed.length * 3);
    
    for (let i = 0; i < packed.length; i++) {
        const val = packed[i];
        rgb[i * 3] = (val >> 16) & 0xff;
        rgb[i * 3 + 1] = (val >> 8) & 0xff;
        rgb[i * 3 + 2] = val & 0xff;
    }
    
    return rgb;
}

/**
 * 從圖像中獲取背景顏色
 * 通過量化和找最頻繁的顏色
 * @param {Uint8ClampedArray} imageData - RGB 像素資料
 * @param {number} bitsPerChannel - 量化位數 (預設 6)
 * @returns {Uint8ClampedArray} RGB 背景顏色
 */
export function getBGColor(imageData, bitsPerChannel = 6) {
    // 量化圖像
    const quantized = quantize(imageData, bitsPerChannel);
    
    // 打包成整數
    const packed = packRGB(quantized);
    
    // 計算直方圖
    const histogram = new Map();
    for (let i = 0; i < packed.length; i++) {
        const val = packed[i];
        histogram.set(val, (histogram.get(val) || 0) + 1);
    }
    
    // 找最頻繁的顏色
    let maxCount = 0;
    let bgColorPacked = 0;
    for (const [color, count] of histogram) {
        if (count > maxCount) {
            maxCount = count;
            bgColorPacked = color;
        }
    }
    
    // 解包
    const bgColor = new Uint8ClampedArray(3);
    bgColor[0] = (bgColorPacked >> 16) & 0xff;
    bgColor[1] = (bgColorPacked >> 8) & 0xff;
    bgColor[2] = bgColorPacked & 0xff;
    
    return bgColor;
}

/**
 * 將 RGB 轉換為飽和度和亮度
 * @param {Uint8ClampedArray|Array} rgb - RGB 值 (3 個元素)
 * @returns {Array<number>} [saturation, value]
 */
export function rgbToSV(rgb) {
    const r = rgb[0] / 255.0;
    const g = rgb[1] / 255.0;
    const b = rgb[2] / 255.0;
    
    const cmax = Math.max(r, g, b);
    const cmin = Math.min(r, g, b);
    const delta = cmax - cmin;
    
    const saturation = cmax === 0 ? 0 : delta / cmax;
    const value = cmax;
    
    return [saturation, value];
}

/**
 * 計算 RGB 陣列的飽和度和亮度
 * @param {Uint8ClampedArray} imageData - RGB 像素資料 (平鋪)
 * @returns {Object} {saturation: Float32Array, value: Float32Array}
 */
export function computeSV(imageData) {
    const numPixels = imageData.length / 3;
    const saturation = new Float32Array(numPixels);
    const value = new Float32Array(numPixels);
    
    for (let i = 0; i < numPixels; i++) {
        const r = imageData[i * 3] / 255.0;
        const g = imageData[i * 3 + 1] / 255.0;
        const b = imageData[i * 3 + 2] / 255.0;
        
        const cmax = Math.max(r, g, b);
        const cmin = Math.min(r, g, b);
        const delta = cmax - cmin;
        
        saturation[i] = cmax === 0 ? 0 : delta / cmax;
        value[i] = cmax;
    }
    
    return { saturation, value };
}

/**
 * 從樣本像素中隨機取樣
 * @param {Uint8ClampedArray} imageData - RGB 像素資料
 * @param {number} sampleFraction - 取樣比例 (0.0 - 1.0)
 * @returns {Uint8ClampedArray} 取樣的 RGB 資料
 */
export function samplePixels(imageData, sampleFraction = 0.05) {
    const numPixels = imageData.length / 3;
    const numSamples = Math.max(1, Math.floor(numPixels * sampleFraction));
    
    // 建立索引陣列並打亂
    const indices = new Uint32Array(numPixels);
    for (let i = 0; i < numPixels; i++) {
        indices[i] = i;
    }
    
    // Fisher-Yates 洗牌
    for (let i = numPixels - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // 提取樣本
    const samples = new Uint8ClampedArray(numSamples * 3);
    for (let i = 0; i < numSamples; i++) {
        const idx = indices[i];
        samples[i * 3] = imageData[idx * 3];
        samples[i * 3 + 1] = imageData[idx * 3 + 1];
        samples[i * 3 + 2] = imageData[idx * 3 + 2];
    }
    
    return samples;
}

/**
 * 判斷樣本像素是否為前景
 * @param {Uint8ClampedArray} bgColor - 背景顏色 RGB
 * @param {Uint8ClampedArray} samples - 樣本像素 RGB
 * @param {number} valueThreshold - 亮度閾值
 * @param {number} satThreshold - 飽和度閾值
 * @returns {Uint8Array} 前景遮罩 (0 或 1)
 */
export function getFGMask(bgColor, samples, valueThreshold = 0.25, satThreshold = 0.20) {
    const numPixels = samples.length / 3;
    const mask = new Uint8Array(numPixels);
    
    const [bgSat, bgVal] = rgbToSV(bgColor);
    const { saturation, value } = computeSV(samples);
    
    for (let i = 0; i < numPixels; i++) {
        const satDiff = Math.abs(bgSat - saturation[i]);
        const valDiff = Math.abs(bgVal - value[i]);
        
        if (valDiff >= valueThreshold || satDiff >= satThreshold) {
            mask[i] = 1;
        } else {
            mask[i] = 0;
        }
    }
    
    return mask;
}

/**
 * 取出前景樣本
 * @param {Uint8ClampedArray} samples - 全部樣本
 * @param {Uint8Array} mask - 前景遮罩
 * @returns {Uint8ClampedArray} 前景樣本
 */
export function extractForegroundSamples(samples, mask) {
    let count = 0;
    for (let i = 0; i < mask.length; i++) {
        if (mask[i]) count++;
    }
    
    const fgSamples = new Uint8ClampedArray(count * 3);
    let idx = 0;
    
    for (let i = 0; i < mask.length; i++) {
        if (mask[i]) {
            fgSamples[idx * 3] = samples[i * 3];
            fgSamples[idx * 3 + 1] = samples[i * 3 + 1];
            fgSamples[idx * 3 + 2] = samples[i * 3 + 2];
            idx++;
        }
    }
    
    return fgSamples;
}

/**
 * 提取調色板
 * @param {Uint8ClampedArray} samples - 取樣像素
 * @param {number} numColors - 顏色數量
 * @param {number} valueThreshold - 亮度閾值
 * @param {number} satThreshold - 飽和度閾值
 * @param {number} kmeansIter - K-means 迭代次數
 * @returns {Uint8ClampedArray} 調色板 (numColors x 3)
 */
export function getPalette(samples, numColors = 8, valueThreshold = 0.25, satThreshold = 0.20, kmeansIter = 40) {
    // 獲取背景顏色
    const bgColor = getBGColor(samples, 6);
    
    // 獲取前景遮罩
    const fgMask = getFGMask(bgColor, samples, valueThreshold, satThreshold);
    
    // 提取前景樣本
    const fgSamples = extractForegroundSamples(samples, fgMask);
    
    // 如果沒有前景樣本，返回簡單調色板
    if (fgSamples.length === 0) {
        const palette = new Uint8ClampedArray(numColors * 3);
        palette[0] = bgColor[0];
        palette[1] = bgColor[1];
        palette[2] = bgColor[2];
        // 填充其他顏色
        for (let i = 3; i < numColors * 3; i++) {
            palette[i] = 128;
        }
        return palette;
    }
    
    // 轉換為 Float32Array 進行 K-means
    const fgFloat = new Float32Array(fgSamples.length);
    for (let i = 0; i < fgSamples.length; i++) {
        fgFloat[i] = fgSamples[i];
    }
    
    // 執行 K-means
    const result = kmeans(fgFloat, Math.max(1, numColors - 1), kmeansIter);
    
    // 組合背景顏色和 K-means 中心
    const palette = new Uint8ClampedArray(numColors * 3);
    palette[0] = bgColor[0];
    palette[1] = bgColor[1];
    palette[2] = bgColor[2];
    
    for (let i = 0; i < result.centers.length; i++) {
        const center = result.centers[i];
        palette[(i + 1) * 3] = center[0];
        palette[(i + 1) * 3 + 1] = center[1];
        palette[(i + 1) * 3 + 2] = center[2];
    }
    
    return palette;
}

/**
 * 套用調色板到圖像
 * @param {Uint8ClampedArray} imageData - 圖像 RGB 資料
 * @param {Uint8ClampedArray} palette - 調色板
 * @param {number} valueThreshold - 亮度閾值
 * @param {number} satThreshold - 飽和度閾值
 * @returns {Uint8ClampedArray} 索引化的圖像 (單通道)
 */
export function applyPalette(imageData, palette, valueThreshold = 0.25, satThreshold = 0.20) {
    // 獲取背景顏色
    const bgColor = new Uint8ClampedArray(3);
    bgColor[0] = palette[0];
    bgColor[1] = palette[1];
    bgColor[2] = palette[2];
    
    // 獲取前景遮罩
    const fgMask = getFGMask(bgColor, imageData, valueThreshold, satThreshold);
    
    // 向量量化
    const numPixels = imageData.length / 3;
    const labels = new Uint8Array(numPixels);
    
    // 轉換調色板為 Float32Array
    const paletteFloat = new Float32Array(palette.length);
    for (let i = 0; i < palette.length; i++) {
        paletteFloat[i] = palette[i];
    }
    
    // 轉換圖像資料為 Float32Array
    const imageFloat = new Float32Array(imageData.length);
    for (let i = 0; i < imageData.length; i++) {
        imageFloat[i] = imageData[i];
    }
    
    // 創建調色板質心陣列
    const paletteBooks = [];
    for (let i = 0; i < palette.length / 3; i++) {
        const book = new Uint8ClampedArray(3);
        book[0] = palette[i * 3];
        book[1] = palette[i * 3 + 1];
        book[2] = palette[i * 3 + 2];
        paletteBooks.push(book);
    }
    
    // 量化
    const quantized = vq(imageFloat, paletteBooks);
    
    // 複製到結果
    for (let i = 0; i < numPixels; i++) {
        labels[i] = quantized[i];
    }
    
    return labels;
}

export { quantize as quantizeImage };
