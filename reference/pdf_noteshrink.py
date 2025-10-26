#!/usr/bin/env python3
"""
PDF 壓縮工具 - 使用 noteshrink 算法
將 PDF 轉換為圖檔 → 用 noteshrink 處理 → 再轉回 PDF
"""

import sys
import os
import re
import subprocess
import shlex
from argparse import ArgumentParser

import numpy as np
from PIL import Image
import fitz  # PyMuPDF
from scipy.cluster.vq import kmeans, vq

######################################################################

def quantize(image, bits_per_channel=None):
    """Reduces the number of bits per channel in the given image."""
    if bits_per_channel is None:
        bits_per_channel = 6
    
    assert image.dtype == np.uint8
    shift = 8 - bits_per_channel
    halfbin = (1 << shift) >> 1
    
    return ((image.astype(int) >> shift) << shift) + halfbin

######################################################################

def pack_rgb(rgb):
    """Packs a 24-bit RGB triples into a single integer."""
    orig_shape = None
    
    if isinstance(rgb, np.ndarray):
        assert rgb.shape[-1] == 3
        orig_shape = rgb.shape[:-1]
    else:
        assert len(rgb) == 3
        rgb = np.array(rgb)
    
    rgb = rgb.astype(int).reshape((-1, 3))
    
    packed = (rgb[:, 0] << 16 | rgb[:, 1] << 8 | rgb[:, 2])
    
    if orig_shape is None:
        return packed
    else:
        return packed.reshape(orig_shape)

######################################################################

def unpack_rgb(packed):
    """Unpacks a single integer or array of integers into RGB values."""
    orig_shape = None
    
    if isinstance(packed, np.ndarray):
        assert packed.dtype == int
        orig_shape = packed.shape
        packed = packed.reshape((-1, 1))
    
    rgb = ((packed >> 16) & 0xff,
           (packed >> 8) & 0xff,
           (packed) & 0xff)
    
    if orig_shape is None:
        return rgb
    else:
        return np.hstack(rgb).reshape(orig_shape + (3,))

######################################################################

def get_bg_color(image, bits_per_channel=None):
    """Obtains the background color from an image."""
    assert image.shape[-1] == 3
    
    quantized = quantize(image, bits_per_channel).astype(int)
    packed = pack_rgb(quantized)
    
    unique, counts = np.unique(packed, return_counts=True)
    packed_mode = unique[counts.argmax()]
    
    return unpack_rgb(packed_mode)

######################################################################

def rgb_to_sv(rgb):
    """Convert RGB to saturation and value."""
    if not isinstance(rgb, np.ndarray):
        rgb = np.array(rgb)
    
    axis = len(rgb.shape) - 1
    cmax = rgb.max(axis=axis).astype(np.float32)
    cmin = rgb.min(axis=axis).astype(np.float32)
    delta = cmax - cmin
    
    saturation = delta.astype(np.float32) / cmax.astype(np.float32)
    saturation = np.where(cmax == 0, 0, saturation)
    
    value = cmax / 255.0
    
    return saturation, value

######################################################################

def sample_pixels(img, sample_fraction):
    """Pick a fixed percentage of pixels in the image."""
    pixels = img.reshape((-1, 3))
    num_pixels = pixels.shape[0]
    num_samples = int(num_pixels * sample_fraction)
    
    idx = np.arange(num_pixels)
    np.random.shuffle(idx)
    
    return pixels[idx[:num_samples]]

######################################################################

def get_fg_mask(bg_color, samples, value_threshold, sat_threshold):
    """Determine whether each pixel is foreground."""
    s_bg, v_bg = rgb_to_sv(bg_color)
    s_samples, v_samples = rgb_to_sv(samples)
    
    s_diff = np.abs(s_bg - s_samples)
    v_diff = np.abs(v_bg - v_samples)
    
    return ((v_diff >= value_threshold) | (s_diff >= sat_threshold))

######################################################################

def get_palette(samples, num_colors, value_threshold, sat_threshold, kmeans_iter=40):
    """Extract the palette using K-means clustering."""
    
    bg_color = get_bg_color(samples, 6)
    fg_mask = get_fg_mask(bg_color, samples, value_threshold, sat_threshold)
    
    if fg_mask.sum() == 0:
        # If no foreground pixels, return simple palette
        palette = np.ones((num_colors, 3), dtype=np.uint8) * 128
        palette[0] = bg_color
        return palette
    
    centers, _ = kmeans(samples[fg_mask].astype(np.float32),
                        num_colors - 1,
                        iter=kmeans_iter)
    
    palette = np.vstack((bg_color, centers)).astype(np.uint8)
    return palette

######################################################################

def apply_palette(img, palette, value_threshold, sat_threshold):
    """Apply palette to image."""
    bg_color = palette[0]
    fg_mask = get_fg_mask(bg_color, img, value_threshold, sat_threshold)
    
    orig_shape = img.shape
    pixels = img.reshape((-1, 3))
    fg_mask_flat = fg_mask.flatten()
    
    num_pixels = pixels.shape[0]
    labels = np.zeros(num_pixels, dtype=np.uint8)
    
    labels[fg_mask_flat], _ = vq(pixels[fg_mask_flat], palette)
    
    return labels.reshape(orig_shape[:-1])

######################################################################

def save_png(output_filename, labels, palette, dpi, saturate, white_bg):
    """Save the label/palette pair as an indexed PNG image."""
    
    if saturate:
        palette = palette.astype(np.float32)
        pmin = palette.min()
        pmax = palette.max()
        if pmax > pmin:
            palette = 255 * (palette - pmin) / (pmax - pmin)
        palette = palette.astype(np.uint8)
    
    if white_bg:
        palette = palette.copy()
        palette[0] = (255, 255, 255)
    
    output_img = Image.fromarray(labels, 'P')
    output_img.putpalette(palette.flatten())
    output_img.save(output_filename, dpi=dpi)

######################################################################

def pdf_to_images(pdf_path, output_dir, dpi=150):
    """Convert PDF to PNG images."""
    
    print(f"將 PDF 轉換為圖檔: {pdf_path}")
    
    pdf_doc = fitz.open(pdf_path)
    image_files = []
    
    for page_num in range(len(pdf_doc)):
        page = pdf_doc[page_num]
        
        # 轉換為圖片
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        # 儲存為 PNG
        img_path = os.path.join(output_dir, f"page_{page_num:04d}.png")
        pix.save(img_path)
        image_files.append(img_path)
        
        print(f"  第 {page_num + 1}/{len(pdf_doc)} 頁 → {os.path.basename(img_path)}")
    
    pdf_doc.close()
    return image_files

######################################################################

def images_to_pdf(image_files, output_pdf, pdf_cmd='convert %i %o'):
    """Convert PNG images to PDF."""
    
    print(f"\n將圖檔轉換為 PDF: {output_pdf}")
    
    cmd = pdf_cmd.replace('%i', ' '.join(image_files))
    cmd = cmd.replace('%o', output_pdf)
    
    print(f"執行命令: {cmd}")
    
    try:
        result = subprocess.call(shlex.split(cmd))
        if result == 0:
            print(f"✅ PDF 已建立: {output_pdf}")
            return True
        else:
            print(f"❌ PDF 轉換失敗")
            return False
    except OSError as e:
        print(f"❌ 錯誤: {e}")
        return False

######################################################################

def process_images_with_noteshrink(image_files, output_dir, options):
    """Process images with noteshrink algorithm."""
    
    print(f"\n使用 noteshrink 處理圖檔...")
    print(f"  色深: {options['num_colors']} 色")
    print(f"  飽和度提升: {options['saturate']}")
    print(f"  全域調色板: {options['global_palette']}")
    
    # 建立全域調色板（如果需要）
    global_palette = None
    if options['global_palette']:
        print("  建立全域調色板...", end='', flush=True)
        all_samples = []
        
        for img_file in image_files:
            img = np.array(Image.open(img_file).convert('RGB'))
            samples = sample_pixels(img, options['sample_fraction'])
            all_samples.append(samples)
        
        all_samples = np.vstack(all_samples)
        global_palette = get_palette(all_samples, options['num_colors'],
                                    options['value_threshold'],
                                    options['sat_threshold'])
        print(" 完成")
    
    processed_files = []
    
    for idx, img_file in enumerate(image_files):
        print(f"  處理 {idx + 1}/{len(image_files)}: {os.path.basename(img_file)}", end='', flush=True)
        
        # 讀取圖檔
        img = np.array(Image.open(img_file).convert('RGB'))
        
        # 讀取原始 DPI
        pil_img = Image.open(img_file)
        if 'dpi' in pil_img.info:
            dpi = pil_img.info['dpi']
        else:
            dpi = (150, 150)
        
        # 獲取調色板
        if global_palette is not None:
            palette = global_palette
        else:
            samples = sample_pixels(img, options['sample_fraction'])
            palette = get_palette(samples, options['num_colors'],
                                options['value_threshold'],
                                options['sat_threshold'])
        
        # 套用調色板
        labels = apply_palette(img, palette,
                             options['value_threshold'],
                             options['sat_threshold'])
        
        # 儲存為 PNG
        output_file = os.path.join(output_dir, f"processed_{idx:04d}.png")
        save_png(output_file, labels, palette, dpi,
                options['saturate'], options['white_bg'])
        
        processed_files.append(output_file)
        print(" ✓")
    
    return processed_files

######################################################################

def main():
    parser = ArgumentParser(description='PDF 壓縮工具 (noteshrink 算法)')
    
    parser.add_argument('input_pdf', help='輸入 PDF 檔案')
    parser.add_argument('-o', '--output', dest='output_pdf', default='output_noteshrink.pdf',
                        help='輸出 PDF 檔案 (預設: output_noteshrink.pdf)')
    parser.add_argument('-n', '--num-colors', type=int, default=8,
                        help='輸出顏色數 (預設: 8)')
    parser.add_argument('-d', '--dpi', type=int, default=150,
                        help='轉換 DPI (預設: 150)')
    parser.add_argument('-v', '--value-threshold', type=float, default=0.25,
                        help='背景亮度閾值 (預設: 0.25)')
    parser.add_argument('-s', '--sat-threshold', type=float, default=0.20,
                        help='背景飽和度閾值 (預設: 0.20)')
    parser.add_argument('--no-saturate', action='store_true',
                        help='不進行飽和度提升')
    parser.add_argument('-g', '--global-palette', action='store_true',
                        help='使用全域調色板')
    parser.add_argument('--white-bg', action='store_true',
                        help='將背景設為白色')
    parser.add_argument('-p', '--sample-fraction', type=float, default=0.05,
                        help='取樣像素比例 (預設: 0.05)')
    parser.add_argument('-c', '--pdf-cmd', default='convert %i %o',
                        help='PDF 轉換命令 (預設: convert %i %o)')
    parser.add_argument('--keep-temp', action='store_true',
                        help='保留臨時檔案')
    
    args = parser.parse_args()
    
    # 檢查輸入檔案
    if not os.path.exists(args.input_pdf):
        print(f"❌ 找不到檔案: {args.input_pdf}")
        sys.exit(1)
    
    # 顯示原始檔案大小
    original_size_mb = os.path.getsize(args.input_pdf) / (1024 * 1024)
    print(f"原始檔案大小: {original_size_mb:.2f} MB\n")
    
    # 建立臨時目錄
    temp_dir = 'noteshrink_temp'
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir)
    
    try:
        # 1. PDF → 圖檔
        image_files = pdf_to_images(args.input_pdf, temp_dir, dpi=args.dpi)
        
        # 2. 用 noteshrink 處理圖檔
        options = {
            'num_colors': args.num_colors,
            'value_threshold': args.value_threshold,
            'sat_threshold': args.sat_threshold,
            'saturate': not args.no_saturate,
            'global_palette': args.global_palette,
            'white_bg': args.white_bg,
            'sample_fraction': args.sample_fraction,
        }
        
        processed_files = process_images_with_noteshrink(image_files, temp_dir, options)
        
        # 3. 圖檔 → PDF
        success = images_to_pdf(processed_files, args.output_pdf, args.pdf_cmd)
        
        if success:
            output_size_mb = os.path.getsize(args.output_pdf) / (1024 * 1024)
            reduction = 100 * (1 - output_size_mb / original_size_mb)
            print(f"\n✅ 完成！")
            print(f"輸出檔案大小: {output_size_mb:.2f} MB (壓縮 {reduction:.1f}%)")
        
    finally:
        # 清理臨時檔案
        if not args.keep_temp and os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir)
            print(f"\n清理臨時檔案")

if __name__ == '__main__':
    main()
