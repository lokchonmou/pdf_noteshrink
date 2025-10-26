/**
 * K-means 聚類實現
 * 用於 noteshrink 調色板提取
 */

/**
 * 計算歐幾里得距離
 * @param {Array<number>} a 
 * @param {Array<number>} b 
 * @returns {number}
 */
function euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

/**
 * 計算多個點到質心的距離平方
 * @param {Float32Array} points - 點陣列 (平鋪)
 * @param {number} dim - 維度
 * @param {Array<Array<number>>} centers - 質心
 * @returns {Array<number>} 最近質心的索引
 */
function findNearest(points, dim, centers) {
    const numPoints = points.length / dim;
    const labels = new Uint32Array(numPoints);
    
    for (let i = 0; i < numPoints; i++) {
        let minDist = Infinity;
        let minIdx = 0;
        
        const point = points.slice(i * dim, (i + 1) * dim);
        
        for (let j = 0; j < centers.length; j++) {
            const dist = euclideanDistance(point, centers[j]);
            if (dist < minDist) {
                minDist = dist;
                minIdx = j;
            }
        }
        
        labels[i] = minIdx;
    }
    
    return labels;
}

/**
 * 更新質心
 * @param {Float32Array} points 
 * @param {number} dim 
 * @param {Uint32Array} labels 
 * @param {number} k 
 * @returns {Array<Array<number>>} 新質心
 */
function updateCenters(points, dim, labels, k) {
    const centers = [];
    const counts = new Uint32Array(k);
    const sums = [];
    
    for (let j = 0; j < k; j++) {
        sums[j] = new Float32Array(dim);
    }
    
    // 累加每個質心對應的點
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        counts[label]++;
        
        for (let d = 0; d < dim; d++) {
            sums[label][d] += points[i * dim + d];
        }
    }
    
    // 計算平均值
    for (let j = 0; j < k; j++) {
        if (counts[j] === 0) {
            // 如果質心無點，保持不變
            centers[j] = sums[j];
        } else {
            const center = new Float32Array(dim);
            for (let d = 0; d < dim; d++) {
                center[d] = sums[j][d] / counts[j];
            }
            centers[j] = center;
        }
    }
    
    return centers;
}

/**
 * 初始化質心 (Kmeans++ 初始化)
 * @param {Float32Array} points 
 * @param {number} dim 
 * @param {number} k 
 * @returns {Array<Array<number>>}
 */
function initializeCenters(points, dim, k) {
    const centers = [];
    const numPoints = points.length / dim;
    
    // 隨機選擇第一個質心
    const firstIdx = Math.floor(Math.random() * numPoints);
    const firstCenter = points.slice(firstIdx * dim, (firstIdx + 1) * dim);
    centers.push(Array.from(firstCenter));
    
    // 選擇其餘質心
    for (let i = 1; i < k; i++) {
        // 計算每個點到最近質心的距離
        const distances = new Float32Array(numPoints);
        let maxDist = 0;
        
        for (let j = 0; j < numPoints; j++) {
            let minDist = Infinity;
            const point = points.slice(j * dim, (j + 1) * dim);
            
            for (const center of centers) {
                const dist = euclideanDistance(point, center);
                if (dist < minDist) {
                    minDist = dist;
                }
            }
            
            distances[j] = minDist * minDist;
            maxDist = Math.max(maxDist, distances[j]);
        }
        
        // 按距離加權隨機選擇
        let random = Math.random() * distances.reduce((a, b) => a + b, 0);
        let selected = 0;
        
        for (let j = 0; j < numPoints; j++) {
            random -= distances[j];
            if (random <= 0) {
                selected = j;
                break;
            }
        }
        
        const center = points.slice(selected * dim, (selected + 1) * dim);
        centers.push(Array.from(center));
    }
    
    return centers;
}

/**
 * K-means 聚類
 * @param {Float32Array|Uint8ClampedArray} data - 數據點 (平鋪)
 * @param {number} k - 質心個數
 * @param {number} maxIter - 最大迭代次數 (預設 40)
 * @returns {Object} {centers, labels}
 */
export function kmeans(data, k, maxIter = 40) {
    if (!(data instanceof Float32Array)) {
        // 轉換為 Float32Array
        data = new Float32Array(data);
    }
    
    // 假設數據是 RGB (3 維)
    const dim = 3;
    const numPoints = data.length / dim;
    
    if (numPoints < k) {
        throw new Error(`數據點數 (${numPoints}) 必須大於質心數 (${k})`);
    }
    
    // 初始化質心
    let centers = initializeCenters(data, dim, k);
    let labels = new Uint32Array(numPoints);
    let oldLabels = new Uint32Array(numPoints);
    
    // 迭代
    for (let iter = 0; iter < maxIter; iter++) {
        // 分配點到最近的質心
        labels = findNearest(data, dim, centers);
        
        // 檢查收斂
        let converged = true;
        for (let i = 0; i < numPoints; i++) {
            if (labels[i] !== oldLabels[i]) {
                converged = false;
                break;
            }
        }
        
        if (converged && iter > 0) {
            break;
        }
        
        oldLabels.set(labels);
        
        // 更新質心
        centers = updateCenters(data, dim, labels, k);
    }
    
    return {
        centers: centers.map(c => new Uint8ClampedArray(c)),
        labels: labels,
    };
}

/**
 * 向量量化 - 將點映射到最近的質心
 * @param {Float32Array} data - 數據點
 * @param {Array<Uint8ClampedArray>} book - 碼本 (質心)
 * @returns {Uint32Array} 標籤
 */
export function vq(data, book) {
    if (!(data instanceof Float32Array)) {
        data = new Float32Array(data);
    }
    
    const dim = 3;
    const numPoints = data.length / dim;
    const labels = new Uint32Array(numPoints);
    
    for (let i = 0; i < numPoints; i++) {
        let minDist = Infinity;
        let minIdx = 0;
        
        const point = data.slice(i * dim, (i + 1) * dim);
        
        for (let j = 0; j < book.length; j++) {
            const dist = euclideanDistance(point, Array.from(book[j]));
            if (dist < minDist) {
                minDist = dist;
                minIdx = j;
            }
        }
        
        labels[i] = minIdx;
    }
    
    return labels;
}
