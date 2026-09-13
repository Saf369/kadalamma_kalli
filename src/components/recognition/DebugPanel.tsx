'use client';

/**
 * DebugPanel
 *
 * Optional floating panel that displays live AI recognition scores.
 * Toggle with the keyboard shortcut D key, or via the debug prop.
 *
 * Shows:
 *   - Current recognizer status (idle / recognizing / complete)
 *   - Recognized text
 *   - OCR confidence
 *   - Text similarity
 *   - Final confidence score
 *   - Target match result
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { DetectionResult } from './KadalammaKalliDetector';

interface DebugPanelProps {
  /** The detector instance to subscribe to. */
  detector: import('./KadalammaKalliDetector').KadalammaKalliDetector | null;
  /** Whether the panel is visible initially. */
  visible: boolean;
  onToggle: () => void;
}

type StatusType = 'idle' | 'recognizing' | 'complete' | 'error';

interface PanelState {
  status: StatusType;
  result: DetectionResult | null;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="w-8 text-right font-mono text-[10px] opacity-80">{pct}%</span>
    </div>
  );
}

export default function DebugPanel({ detector, visible, onToggle }: DebugPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>({
    status: 'idle',
    result: null,
  });

  const handleRecognitionStarted = useCallback(() => {
    setPanelState((prev) => ({ ...prev, status: 'recognizing', result: null }));
  }, []);

  const handleDetectionComplete = useCallback((e: Event) => {
    const result = (e as CustomEvent<DetectionResult>).detail;
    setPanelState({ status: 'complete', result });
  }, []);

  const handleError = useCallback(() => {
    setPanelState((prev) => ({ ...prev, status: 'error' }));
  }, []);

  // Subscribe to detector events
  useEffect(() => {
    if (!detector) return;

    detector.addEventListener('recognitionStarted', handleRecognitionStarted);
    detector.addEventListener('detectionComplete', handleDetectionComplete);
    detector.addEventListener('recognitionError', handleError);

    return () => {
      detector.removeEventListener('recognitionStarted', handleRecognitionStarted);
      detector.removeEventListener('detectionComplete', handleDetectionComplete);
      detector.removeEventListener('recognitionError', handleError);
    };
  }, [detector, handleRecognitionStarted, handleDetectionComplete, handleError]);

  // Keyboard shortcut: D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        onToggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggle]);

  if (!visible) {
    return (
      <button
        onClick={onToggle}
        title="Toggle AI Debug Panel (D)"
        className="absolute bottom-5 right-5 z-50 w-8 h-8 rounded-full bg-purple-900/70 border border-purple-500/40 text-purple-300 text-xs font-bold shadow-xl hover:bg-purple-800/80 transition-all flex items-center justify-center"
      >
        D
      </button>
    );
  }

  const { status, result } = panelState;
  const isRecognizing = status === 'recognizing';
  const matched = result?.matched ?? false;

  return (
    <div className="absolute bottom-20 right-4 z-50 w-72 bg-neutral-950/92 backdrop-blur-2xl border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-950/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-purple-950/30">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            isRecognizing
              ? 'bg-amber-400 animate-pulse'
              : matched
              ? 'bg-green-400 shadow-[0_0_8px_#4ade80]'
              : 'bg-purple-400'
          }`} />
          <span className="text-[11px] font-semibold tracking-wider text-purple-200 uppercase">
            AI Handwriting
          </span>
        </div>
        <button
          onClick={onToggle}
          className="text-neutral-500 hover:text-white text-xs transition-colors"
          title="Close (D)"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Status</span>
          <span className={`text-[11px] font-medium ${
            isRecognizing ? 'text-amber-300 animate-pulse' :
            status === 'error' ? 'text-red-400' :
            status === 'complete' ? 'text-neutral-200' :
            'text-neutral-500'
          }`}>
            {isRecognizing ? '🔍 Recognizing…' :
             status === 'error' ? '⚠️ Error' :
             status === 'complete' ? '✓ Complete' :
             '⏳ Waiting for handwriting'}
          </span>
        </div>

        {/* Recognized text */}
        <div>
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">Recognized</span>
          <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 font-mono text-xs text-cyan-200 min-h-[28px]">
            {isRecognizing ? (
              <span className="opacity-50 italic">processing…</span>
            ) : result?.recognizedText ? (
              <span>&ldquo;{result.recognizedText}&rdquo;</span>
            ) : (
              <span className="opacity-40 italic">—</span>
            )}
          </div>
        </div>

        {/* Score bars */}
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Gemini Confidence</span>
            </div>
            <ProgressBar
              value={result?.confidence ?? 0}
              color={
                matched
                  ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                  : 'linear-gradient(90deg, #f59e0b, #fbbf24)'
              }
            />
          </div>
        </div>

        {/* Threshold line */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-neutral-600">Model Decision</span>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            matched
              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
              : 'bg-neutral-800/60 text-neutral-500 border border-neutral-700/40'
          }`}>
            {matched ? '✅ MATCHED' : '❌ NO MATCH'}
          </div>
        </div>

        {/* Target phrase */}
        <div className="border-t border-white/5 pt-2 flex items-center justify-between">
          <span className="text-[10px] text-neutral-600">Target:</span>
          <span className="font-mono text-[10px] text-amber-300/70">kadalamma kalli</span>
        </div>
      </div>
    </div>
  );
}
