/**
 * HandwritingPreprocessor
 *
 * Accepts the raw sand-carving canvas and returns a preprocessed
 * base64 DataURL image suitable for handwriting OCR.
 *
 * Processing steps:
 * 1. Crop to the bounding box of drawn strokes (remove empty margins).
 * 2. Add padding so characters aren't clipped.
 * 3. Invert / normalize to produce dark ink on white background.
 * 4. Apply mild contrast stretch.
 * 5. Denoise (remove isolated single-pixel specks).
 * 6. Resize to a fixed max width/height, preserving aspect ratio.
 */

export interface PreprocessResult {
  dataUrl: string;
  width: number;
  height: number;
  isEmpty: boolean;
}

const MAX_OUTPUT_WIDTH = 640;
const MAX_OUTPUT_HEIGHT = 160;
const PADDING = 12; // px added around bounding box
const ALPHA_THRESHOLD = 30; // minimum alpha to count as a drawn pixel
const NOISE_THRESHOLD = 2; // radius used for trivial speck rejection

/**
 * Preprocess the given canvas for handwriting OCR.
 * The source canvas uses dark strokes on a transparent background
 * (mix-blend-multiply), so we read the alpha channel to detect strokes.
 */
export function preprocessHandwriting(sourceCanvas: HTMLCanvasElement): PreprocessResult {
  const src = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!src) {
    return { dataUrl: '', width: 0, height: 0, isEmpty: true };
  }

  const { width: W, height: H } = sourceCanvas;
  const imageData = src.getImageData(0, 0, W, H);
  const data = imageData.data;

  // --- Step 1: Find bounding box of drawn pixels ---
  let minX = W, maxX = 0, minY = H, maxY = 0;
  let pixelCount = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        pixelCount++;
      }
    }
  }

  // Check if effectively empty
  if (pixelCount < 50 || maxX <= minX || maxY <= minY) {
    return { dataUrl: '', width: 0, height: 0, isEmpty: true };
  }

  // --- Step 2: Add padding ---
  minX = Math.max(0, minX - PADDING);
  minY = Math.max(0, minY - PADDING);
  maxX = Math.min(W - 1, maxX + PADDING);
  maxY = Math.min(H - 1, maxY + PADDING);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // --- Step 3: Compute output size maintaining aspect ratio ---
  const scale = Math.min(MAX_OUTPUT_WIDTH / cropW, MAX_OUTPUT_HEIGHT / cropH, 1.0);
  const outW = Math.max(1, Math.round(cropW * scale));
  const outH = Math.max(1, Math.round(cropH * scale));

  // --- Step 4: Render onto output canvas ---
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext('2d')!;

  // White background for OCR
  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, outW, outH);

  // Draw the cropped region from the source using the *color channels* (not alpha).
  // The sand canvas paints dark RGB values with varying alpha.
  // We composite onto white to get a natural light-sand / dark-stroke look.
  outCtx.drawImage(
    sourceCanvas,
    minX, minY, cropW, cropH,
    0, 0, outW, outH,
  );

  // --- Step 5: Post-process pixels: invert if needed & enhance contrast ---
  const outData = outCtx.getImageData(0, 0, outW, outH);
  const px = outData.data;

  let sumBrightness = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    sumBrightness += (r + g + b) / 3;
  }
  const avgBrightness = sumBrightness / (outW * outH);

  // If the background is dark (avg < 128), invert so we get dark-on-white
  const shouldInvert = avgBrightness < 128;

  // Compute min/max luminance for contrast stretch
    // We no longer invert or grayscale the image because Gemini Vision
    // performs much better with natural, full-color contextual images.
    
    // CRITICAL: We must remove transparency before sending to Gemini.
    // Transparent PNGs often get flattened onto a black background by AI models.
    // Since our text is dark, dark-on-black becomes invisible!
    // We will composite the pixels over a white/sand background.
    for (let i = 0; i < px.length; i += 4) {
      const alpha = px[i + 3] / 255;
      // Blend with white (255, 255, 255)
      px[i] = Math.round(px[i] * alpha + 255 * (1 - alpha));
      px[i + 1] = Math.round(px[i + 1] * alpha + 255 * (1 - alpha));
      px[i + 2] = Math.round(px[i + 2] * alpha + 255 * (1 - alpha));
      px[i + 3] = 255; // make fully opaque
    }

  outCtx.putImageData(outData, 0, 0);

  // --- Step 6: Mild 3x3 median-like denoise pass to remove single specks ---
  denoiseCanvas(outCtx, outW, outH);

  const dataUrl = outCanvas.toDataURL('image/png');
  return { dataUrl, width: outW, height: outH, isEmpty: false };
}

/** 
 * Very lightweight noise removal: pixels that are dark but have no dark
 * neighbours above NOISE_THRESHOLD are set to white.
 */
function denoiseCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const px = imgData.data;

  const isDark = (idx: number) => px[idx] < 128;

  for (let y = NOISE_THRESHOLD; y < h - NOISE_THRESHOLD; y++) {
    for (let x = NOISE_THRESHOLD; x < w - NOISE_THRESHOLD; x++) {
      const idx = (y * w + x) * 4;
      if (!isDark(idx)) continue;

      // Count dark neighbours in a 5x5 window
      let darkNeighbours = 0;
      for (let dy = -NOISE_THRESHOLD; dy <= NOISE_THRESHOLD; dy++) {
        for (let dx = -NOISE_THRESHOLD; dx <= NOISE_THRESHOLD; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = ((y + dy) * w + (x + dx)) * 4;
          if (isDark(ni)) darkNeighbours++;
        }
      }

      if (darkNeighbours < 2) {
        // Isolated speck — turn white
        px[idx] = 255;
        px[idx + 1] = 255;
        px[idx + 2] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
