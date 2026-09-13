/**
 * KadalammaKalliDetector
 *
 * Orchestrates the full handwriting recognition pipeline using Gemini API:
 *
 *   Canvas → Preprocess → API Route (/api/recognize-handwriting) → Event
 *
 * Usage:
 *   const detector = new KadalammaKalliDetector();
 *   detector.addEventListener('targetDetected', (e) => { ... });
 *   await detector.detectTargetHandwriting(canvas);
 */

import { preprocessHandwriting } from './HandwritingPreprocessor';

// ─── Result type ─────────────────────────────────────────────────────────────

export interface DetectionResult {
  /** Text interpreted by Gemini. */
  recognizedText: string;
  /** Whether Gemini thinks it's Kadalamma Kalli. */
  matched: boolean;
  /** 0.0–1.0 confidence from Gemini. */
  confidence: number;
  /** Whether the canvas was judged empty before attempting recognition. */
  skippedEmpty: boolean;
  /** ISO timestamp of this detection attempt. */
  timestamp: string;
}

// ─── Detector configuration ──────────────────────────────────────────────────

export interface DetectorConfig {
  /** Minimum number of canvas drawn pixels to attempt recognition (avoids empty canvas calls). */
  minPixelCount?: number;
  /** Debounce interval in ms: ignore recognition requests within this window. */
  debounceMs?: number;
}

const DEFAULT_CONFIG: Required<DetectorConfig> = {
  minPixelCount: 80,
  debounceMs: 500,
};

// ─── Custom event type ────────────────────────────────────────────────────────

export class TargetDetectedEvent extends Event {
  constructor(public readonly result: DetectionResult) {
    super('targetDetected', { bubbles: false, cancelable: false });
  }
}

// ─── Main detector class ──────────────────────────────────────────────────────

export class KadalammaKalliDetector extends EventTarget {
  private config: Required<DetectorConfig>;

  private lastCallTime = 0;
  private isRecognizing = false;
  private lastResult: DetectionResult | null = null;
  private lastCanvasHash = '';

  // Listeners registered via onTargetDetected for convenience
  private _onTargetDetected: ((result: DetectionResult) => void) | null = null;
  private _onTargetDetectedWrapper: EventListener | null = null;

  constructor(config: DetectorConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Convenience setter for the targetDetected event. */
  set onTargetDetected(handler: ((result: DetectionResult) => void) | null) {
    // Remove old listener if present
    if (this._onTargetDetectedWrapper) {
      this.removeEventListener('targetDetected', this._onTargetDetectedWrapper);
      this._onTargetDetectedWrapper = null;
    }
    this._onTargetDetected = handler;
    if (handler) {
      const wrapper: EventListener = (e: Event) => {
        handler((e as TargetDetectedEvent).result);
      };
      this._onTargetDetectedWrapper = wrapper;
      this.addEventListener('targetDetected', wrapper);
    }
  }

  /**
   * Run the full recognition pipeline on the given canvas.
   *
   * Returns the DetectionResult (useful for debug panels / logging).
   * Also dispatches a 'targetDetected' event if matched === true.
   *
   * Guards:
   * - Debounce: skips if called < debounceMs after the previous call.
   * - Empty canvas: skips if preprocessing finds < minPixelCount pixels.
   * - Busy: skips if a recognition is already in progress.
   */
  async detectTargetHandwriting(canvas: HTMLCanvasElement): Promise<DetectionResult | null> {
    const now = Date.now();

    // Debounce guard
    if (now - this.lastCallTime < this.config.debounceMs) {
      return null;
    }

    // Busy guard
    if (this.isRecognizing) {
      return null;
    }

    this.lastCallTime = now;
    this.isRecognizing = true;

    try {
      // ── Step 1: Preprocess ────────────────────────────────────────────
      const preprocessed = preprocessHandwriting(canvas);

      if (preprocessed.isEmpty) {
        const emptyResult: DetectionResult = {
          recognizedText: '',
          matched: false,
          confidence: 0,
          skippedEmpty: true,
          timestamp: new Date().toISOString(),
        };
        this.lastResult = emptyResult;
        this.dispatchEvent(new CustomEvent('detectionComplete', { detail: emptyResult }));
        return emptyResult;
      }

      // Quick canvas hash to avoid redundant calls for the same drawing
      const canvasHash = `${preprocessed.width}x${preprocessed.height}:${preprocessed.dataUrl.slice(-32)}`;
      if (canvasHash === this.lastCanvasHash && this.lastResult && !this.lastResult.matched) {
        return this.lastResult;
      }
      this.lastCanvasHash = canvasHash;

      // Dispatch in-progress event for debug panel
      this.dispatchEvent(new CustomEvent('recognitionStarted'));

      // ── Step 2: Gemini API Call ───────────────────────────────────────
      const res = await fetch('/api/recognize-handwriting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: preprocessed.dataUrl }),
      });

      if (!res.ok) {
        let errMessage = res.statusText;
        try {
          const errBody = await res.json();
          if (errBody.error) errMessage = errBody.error;
        } catch(e) {}
        throw new Error(`API Error: ${errMessage}`);
      }

      const data = await res.json();
      
      const matched = data.isKadalammaKalli === true;

      const result: DetectionResult = {
        recognizedText: data.recognizedText || '',
        matched,
        confidence: data.confidence || 0,
        skippedEmpty: false,
        timestamp: new Date().toISOString(),
      };

      this.lastResult = result;

      // Dispatch events
      console.log("Detection complete:", result); this.dispatchEvent(new CustomEvent("detectionComplete", { detail: result }));

      if (matched) {
        this.dispatchEvent(new TargetDetectedEvent(result));
        // Reset cache so a subsequent detection can re-fire after a new drawing
        this.lastCanvasHash = '';
      }

      return result;
    } catch (err) {
      console.error("[KadalammaKalliDetector] Pipeline error:", err);
      this.dispatchEvent(new CustomEvent('recognitionError', { detail: err }));
      return null;
    } finally {
      this.isRecognizing = false;
    }
  }

  /** Force-reset the cache (e.g. after canvas clear). */
  resetCache() {
    this.lastCanvasHash = '';
    this.lastResult = null;
  }

  /** Get the last detection result (useful for debug panels). */
  get lastDetectionResult(): DetectionResult | null {
    return this.lastResult;
  }

  /** Whether a recognition pass is currently running. */
  get busy(): boolean {
    return this.isRecognizing;
  }

  /** No-op (kept for compatibility with old interface) */
  async dispose(): Promise<void> {
    // nothing to dispose
  }
}
