'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { KadalammaKalliDetector } from './recognition/KadalammaKalliDetector';
import { VigorousSeaController } from './recognition/VigorousSeaController';
import type { DetectionResult } from './recognition/KadalammaKalliDetector';

const DebugPanel = React.lazy(() => import('./recognition/DebugPanel'));

const TARGET_PHRASE = 'kadalamma kalli';
const VIDEO_SRC = '/we_want_to_loop_the_video_so_m.mp4';
const WAVE_MILESTONES = [5.0, 13.5, 21.0, 28.5, 35.5];

// Sand region boundary in percentage of video height (sand is below 45% from top)
const SAND_TOP_RATIO = 0.45;

// Debounce delay after the user stops drawing before triggering recognition (ms)
const RECOGNITION_DEBOUNCE_MS = 300;

// Minimum number of strokes before we attempt recognition (avoids empty-canvas calls)
const MIN_STROKES_FOR_RECOGNITION = 30;

export default function VanillaBeachExperience() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const triggerBarRef = useRef<HTMLDivElement>(null);
  const phraseInputRef = useRef<HTMLInputElement>(null);
  const soundBtnRef = useRef<HTMLButtonElement>(null);

  // AI pipeline refs (persist across renders without causing re-renders)
  const detectorRef = useRef<KadalammaKalliDetector | null>(null);
  const vigorousControllerRef = useRef<VigorousSeaController | null>(null);
  const strokeCountRef = useRef(0);
  const drawingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [debugVisible, setDebugVisible] = useState(false);

  // AI recognition status for the HUD badge
  const [aiStatus, setAiStatus] = useState<
    'idle' | 'recognizing' | 'matched' | 'no-match'
  >('idle');

  const [waveCount, setWaveCount] = useState(0);

  // Keep detector instance in state for DebugPanel subscription
  const [detectorInstance, setDetectorInstance] = useState<KadalammaKalliDetector | null>(null);

  const showStatus = useCallback((msg: string, durationMs = 3500) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), durationMs);
  }, []);

  // ── Main drawing + recognition useEffect ──────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    const drawCanvas = drawCanvasRef.current;
    const triggerBar = triggerBarRef.current;
    const phraseInput = phraseInputRef.current;
    const soundBtn = soundBtnRef.current;

    if (!container || !video || !drawCanvas || !triggerBar || !phraseInput || !soundBtn) return;

    const drawCtx = drawCanvas.getContext('2d', { willReadFrequently: true });
    if (!drawCtx) return;
    drawCtxRef.current = drawCtx;

    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    let activeCarveAnim: number | null = null;

    // ── Initialize AI pipeline ──────────────────────────────────────────────
    const detector = new KadalammaKalliDetector({
      minPixelCount: 80,
      debounceMs: 400,
    });
    detectorRef.current = detector;
    setDetectorInstance(detector);

    // Listen for recognition status events to update HUD badge
    detector.addEventListener('recognitionStarted', () => {
      setAiStatus('recognizing');
    });
    detector.addEventListener('detectionComplete', (e: Event) => {
      const result = (e as CustomEvent<DetectionResult>).detail;
      if (result.skippedEmpty) {
        setAiStatus('idle');
      } else if (result.matched) {
        setAiStatus('matched');
      } else {
        setAiStatus('no-match');
        setTimeout(() => setAiStatus('idle'), 3000);
      }
    });
    detector.addEventListener('recognitionError', () => {
      setAiStatus('idle');
    });

    // ── Vigorous sea controller ─────────────────────────────────────────────
    const vigorousController = new VigorousSeaController({
      videoEl: video,
      containerEl: container,
      drawCanvas: drawCanvas,
      drawCtx: drawCtx,
      onTriggerSurge: () => {
        triggerSurge();
      },
      onComplete: () => {
        showStatus('🏖️ Kadalamma Kalli answered! The sea is calm again.', 4000);
        setAiStatus('idle');
        detector.resetCache();
      },
    });
    vigorousControllerRef.current = vigorousController;

    // Wire detector → vigorous sea
    detector.addEventListener('targetDetected', () => {
      showStatus(
        '🌊 Kadalamma Kalli recognised! The sea awakens…',
        6000,
      );
      vigorousController.trigger();
    });

    // ── Sand drawing utilities ──────────────────────────────────────────────
    function drawCarvedLine(x1: number, y1: number, x2: number, y2: number, radius = 3) {
      if (!drawCtx) return;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(dist / 2.5));
      const scale = radius / 9;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = x1 + (x2 - x1) * t;
        const cy = y1 + (y2 - y1) * t;

        // Sunlit displaced sand rim highlight
        drawCtx.beginPath();
        drawCtx.arc(cx - 3 * scale, cy - 3 * scale, radius * 1.3, 0, Math.PI * 2);
        drawCtx.fillStyle = 'rgba(248, 232, 204, 0.28)';
        drawCtx.fill();

        // Dark trench shadow
        drawCtx.beginPath();
        drawCtx.arc(cx + 2.5 * scale, cy + 2.5 * scale, radius * 1.05, 0, Math.PI * 2);
        drawCtx.fillStyle = 'rgba(38, 20, 8, 0.85)';
        drawCtx.fill();

        // Deep inner gouge core
        drawCtx.beginPath();
        drawCtx.arc(cx + 1 * scale, cy + 1 * scale, radius * 0.5, 0, Math.PI * 2);
        drawCtx.fillStyle = 'rgba(20, 9, 3, 0.96)';
        drawCtx.fill();

        // Sand grain speckles
        if (Math.random() < 0.15) {
          const ang = Math.random() * Math.PI * 2;
          const sDist = radius * (1.1 + Math.random() * 0.4);
          drawCtx.beginPath();
          drawCtx.arc(cx + Math.cos(ang) * sDist, cy + Math.sin(ang) * sDist, 1.2 * scale, 0, Math.PI * 2);
          drawCtx.fillStyle = Math.random() > 0.5 ? 'rgba(240, 220, 185, 0.65)' : 'rgba(30, 15, 5, 0.7)';
          drawCtx.fill();
        }
      }
    }

    // ── AI recognition trigger (called when user stops drawing) ─────────────
    function scheduleRecognition() {
      if (drawingDebounceRef.current) {
        clearTimeout(drawingDebounceRef.current);
      }
      drawingDebounceRef.current = setTimeout(async () => {
        if (!drawCanvas || !detectorRef.current) return;
        if (strokeCountRef.current < MIN_STROKES_FOR_RECOGNITION) return;
        if (vigorousControllerRef.current?.currentState !== 'idle') return;

        await detectorRef.current.detectTargetHandwriting(drawCanvas);
      }, RECOGNITION_DEBOUNCE_MS);
    }

    // ── Mouse / Touch drawing events ──────────────────────────────────────────
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    const getPointerPos = (e: PointerEvent) => {
      if (!drawCanvas) return { x: 0, y: 0 };
      const scaleX = drawCanvas.width / drawCanvas.clientWidth;
      const scaleY = drawCanvas.height / drawCanvas.clientHeight;
      return {
        x: e.offsetX * scaleX,
        y: e.offsetY * scaleY,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (vigorousControllerRef.current?.currentState !== 'idle') return;
      isDrawing = true;
      const pos = getPointerPos(e);
      lastX = pos.x;
      lastY = pos.y;
      drawCarvedLine(lastX, lastY, lastX + 0.1, lastY + 0.1, 3);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawing) return;
      const pos = getPointerPos(e);
      drawCarvedLine(lastX, lastY, pos.x, pos.y, 3);
      lastX = pos.x;
      lastY = pos.y;
      strokeCountRef.current++;
    };

    const onPointerUp = () => {
      if (!isDrawing) return;
      isDrawing = false;
      scheduleRecognition();
    };

    drawCanvas.addEventListener('pointerdown', onPointerDown);
    drawCanvas.addEventListener('pointermove', onPointerMove);
    drawCanvas.addEventListener('pointerup', onPointerUp);
    drawCanvas.addEventListener('pointerout', onPointerUp);
    drawCanvas.addEventListener('pointercancel', onPointerUp);



    // ── Auto-carve preset ────────────────────────────────────────────────────
    function autoCarveText(text = TARGET_PHRASE, triggerAI = false, instant = false) {
      if (activeCarveAnim) {
        cancelAnimationFrame(activeCarveAnim);
        activeCarveAnim = null;
      }
      if (!drawCanvas || !drawCtx) return;

      const cx = drawCanvas.width * 0.5;
      const cy = drawCanvas.height * 0.74;
      const fontString = '40px "Caveat", "Dancing Script", "Segoe Script", cursive, sans-serif';

      drawCtx.save();
      drawCtx.font = fontString;
      const textMetrics = drawCtx.measureText(text);
      drawCtx.restore();

      const textWidth = textMetrics.width;
      const textHeight = 60; // rough bounding box

      if (instant) {
        drawSmoothText(text, cx, cy, fontString);
        strokeCountRef.current = 50; // satisfy AI threshold
        if (triggerAI) scheduleRecognition();
      } else {
        let progress = 0;
        function step() {
          if (!drawCtx) return;
          progress += 0.05;
          if (progress > 1) progress = 1;

          drawCtx.save();
          drawCtx.beginPath();
          drawCtx.rect(cx - textWidth / 2 - 10, cy - textHeight / 2, (textWidth + 20) * progress, textHeight);
          drawCtx.clip();

          drawSmoothText(text, cx, cy, fontString);

          drawCtx.restore();

          if (progress < 1) {
            activeCarveAnim = requestAnimationFrame(step);
          } else {
            activeCarveAnim = null;
            strokeCountRef.current = 50; // satisfy AI threshold
            if (triggerAI) scheduleRecognition();
          }
        }
        step();
      }
    }

    function drawSmoothText(text: string, cx: number, cy: number, fontStr: string) {
      if (!drawCtx) return;
      drawCtx.save();
      drawCtx.font = fontStr;
      drawCtx.textAlign = 'center';
      drawCtx.textBaseline = 'middle';

      // 1. Sunlit rim
      drawCtx.fillStyle = 'rgba(248, 232, 204, 0.4)';
      drawCtx.fillText(text, cx - 1.5, cy - 1.5);

      // 2. Dark shadow
      drawCtx.fillStyle = 'rgba(38, 20, 8, 0.9)';
      drawCtx.fillText(text, cx + 1.5, cy + 1.5);

      // 3. Deep core
      drawCtx.fillStyle = 'rgba(20, 9, 3, 0.95)';
      drawCtx.fillText(text, cx + 0.5, cy + 0.5);

      drawCtx.restore();
    }

    const initialCarveTimer = setTimeout(() => {
      autoCarveText(TARGET_PHRASE);
    }, 500);

    // ── Video wave sync & erasure ─────────────────────────────────────────────
    function eraseCanvasWithWaveFront(progress: number) {
      if (!drawCtx || !drawCanvas) return;
      if (progress <= 0.01) return;

      const startY = 0.45 * drawCanvas.height;
      const targetY = 0.92 * drawCanvas.height;
      const currentWashY = startY + (targetY - startY) * Math.min(1.0, progress);

      drawCtx.save();

      // Create a clipping mask matching the wave's shape (center wedge)
      drawCtx.beginPath();
      drawCtx.moveTo(drawCanvas.width * 0.25, startY);
      drawCtx.lineTo(drawCanvas.width * 0.75, startY);
      drawCtx.lineTo(drawCanvas.width * 0.95, drawCanvas.height);
      drawCtx.lineTo(drawCanvas.width * 0.05, drawCanvas.height);
      drawCtx.closePath();
      drawCtx.clip();

      drawCtx.globalCompositeOperation = 'destination-out';
      drawCtx.fillStyle = 'rgba(0, 0, 0, 1.0)';
      drawCtx.fillRect(0, 0, drawCanvas.width, Math.max(0, currentWashY - 40));

      const grad = drawCtx.createLinearGradient(0, Math.max(0, currentWashY - 40), 0, currentWashY + 40);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.85)');
      grad.addColorStop(0.9, 'rgba(0, 0, 0, 0.35)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
      drawCtx.fillStyle = grad;
      drawCtx.fillRect(0, Math.max(0, currentWashY - 40), drawCanvas.width, 80);
      drawCtx.restore();
    }

    let lastVideoTime = 0;
    const countedMilestones = new Set<number>();

    const onTimeUpdate = () => {
      if (!video) return;

      const curTime = video.currentTime;

      // When the video loops back to the start
      if (curTime < lastVideoTime && lastVideoTime - curTime > 2.0) {
        countedMilestones.clear();
      }

      // Increment wave count when crossing each wave milestone
      for (const m of WAVE_MILESTONES) {
        if (curTime >= m && !countedMilestones.has(m)) {
          countedMilestones.add(m);
          setWaveCount(c => c + 1);
        }
      }

      lastVideoTime = curTime;

      // ONLY erase the canvas if the VigorousSeaController has actively triggered the surge!
      if (vigorousControllerRef.current?.currentState !== 'vigorous') return;

      if (curTime >= 2.4 && curTime <= 5.0) {
        const surgeProgress = (curTime - 2.4) / 2.6;
        eraseCanvasWithWaveFront(surgeProgress);
      } else if (curTime > 5.0 && curTime <= 5.8) {
        eraseCanvasWithWaveFront(1.0);
        strokeCountRef.current = 0;
        detector.resetCache();
      }
    };
    video.addEventListener('timeupdate', onTimeUpdate);

    // ── Audio toggle ─────────────────────────────────────────────────────────
    const onSoundToggle = () => {
      if (!video) return;
      const nextMuted = !video.muted;
      video.muted = nextMuted;
      setIsAudioMuted(nextMuted);
    };
    soundBtn.addEventListener('click', onSoundToggle);

    // ── Surge trigger (shared between manual and AI) ──────────────────────────
    function triggerSurge() {
      if (!video) return;
      video.currentTime = 2.4;
      video.play().catch(() => { });
    }

    // ── Manual trigger bar controls ──────────────────────────────────────────
    function checkAndTrigger() {
      const val = phraseInput?.value.trim();
      if (!val) return;

      strokeCountRef.current = 0;
      detector.resetCache();
      if (drawCtx && drawCanvas) drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      if (drawingDebounceRef.current) clearTimeout(drawingDebounceRef.current);

      autoCarveText(val, true, true);
      showStatus("✍️ Carving into the sand… AI will analyze it!", 3000);
    }

    const surgeBtn = document.getElementById('surgeBtn');
    const autoCarveBtn = document.getElementById('autoCarveBtn');
    const clearBtn = document.getElementById('clearBtn');
    const liveInput = document.getElementById('liveSandInput');

    const onSurgeClick = () => checkAndTrigger();
    const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Enter') checkAndTrigger(); };
    const onAutoCarve = () => {
      strokeCountRef.current = 0;
      detector.resetCache();
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      autoCarveText(TARGET_PHRASE, true); // true = trigger AI after carving
      showStatus("✍️ Carving 'kadalamma kalli' into the sand… AI will recognize it!", 3000);
    };
    const onLiveInput = (e: Event) => {
      const text = (e.target as HTMLInputElement).value;
      strokeCountRef.current = 0;
      detector.resetCache();
      if (drawCtx && drawCanvas) drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      if (drawingDebounceRef.current) clearTimeout(drawingDebounceRef.current);
      if (text.trim().length > 0) {
        autoCarveText(text, true, true); // instant = true
      }
    };
    const onClear = () => {
      if (!drawCtx || !drawCanvas) return;
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      strokeCountRef.current = 0;
      detector.resetCache();
      setAiStatus('idle');
      if (drawingDebounceRef.current) clearTimeout(drawingDebounceRef.current);
    };

    surgeBtn?.addEventListener('click', onSurgeClick);
    phraseInput.addEventListener('keydown', onKeydown);
    autoCarveBtn?.addEventListener('click', onAutoCarve);
    clearBtn?.addEventListener('click', onClear);
    liveInput?.addEventListener('input', onLiveInput);

    return () => {
      clearTimeout(initialCarveTimer);
      if (drawingDebounceRef.current) clearTimeout(drawingDebounceRef.current);
      video.removeEventListener('timeupdate', onTimeUpdate);
      soundBtn.removeEventListener('click', onSoundToggle);
      surgeBtn?.removeEventListener('click', onSurgeClick);
      phraseInput.removeEventListener('keydown', onKeydown);
      autoCarveBtn?.removeEventListener('click', onAutoCarve);
      clearBtn?.removeEventListener('click', onClear);
      liveInput?.removeEventListener('input', onLiveInput);
      detector.dispose();
      vigorousController.dispose();
      detectorRef.current = null;
      vigorousControllerRef.current = null;
    };
  }, [showStatus]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }
  };

  const toggleDebug = useCallback(() => setDebugVisible((v) => !v), []);

  // ── AI status badge label ─────────────────────────────────────────────────
  const aiBadge = {
    idle: null,
    recognizing: { label: '🔍 Recognizing…', cls: 'bg-amber-500/20 border-amber-400/40 text-amber-200 recognizer-pulse' },
    matched: { label: '✅ Kadalamma Kalli!', cls: 'bg-green-500/20 border-green-400/40 text-green-200' },
    'no-match': { label: '❌ Not matched', cls: 'bg-neutral-800/60 border-neutral-700/40 text-neutral-400' },
  }[aiStatus];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-black select-none cursor-crosshair flex items-center justify-center"
    >
      {/* Background Video */}
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* Sand Drawing Canvas */}
      <canvas
        ref={drawCanvasRef}
        width={1600}
        height={900}
        className="absolute inset-0 w-full h-full object-cover pointer-events-auto mix-blend-multiply opacity-95"
        style={{
          transformOrigin: 'center 45%',
          transform: 'perspective(1200px) rotateX(60deg) scale(1.6)',
        }}
      />

      {/* Status Toast */}
      {statusMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-neutral-950/80 backdrop-blur-md border border-cyan-400/30 text-cyan-200 text-xs sm:text-sm px-4 py-2 rounded-full shadow-2xl z-40 animate-fade-in pointer-events-none">
          {statusMessage}
        </div>
      )}

      {/* AI Status Badge */}
      {aiBadge && (
        <div className={`absolute top-24 left-1/2 -translate-x-1/2 text-[11px] px-3 py-1 rounded-full border font-medium z-40 pointer-events-none transition-all ${aiBadge.cls}`}>
          {aiBadge.label}
        </div>
      )}

      {/* Top HUD */}
      <div
        id="topHud"
        className={`absolute top-4 left-6 right-6 flex justify-between items-center pointer-events-none z-30 transition-opacity duration-300 ${hudVisible ? 'opacity-100' : 'opacity-20 hover:opacity-100'
          }`}
      >
        <div className="flex items-center gap-2.5 bg-neutral-950/65 backdrop-blur-xl border border-white/15 px-4 py-2 rounded-full shadow-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse" />
          <span className="text-xs sm:text-sm font-bold tracking-wide text-white">
            Kadalamma Kalli Shore
          </span>
          {/* AI indicator dot */}
          <span
            title="AI Handwriting Recognition active"
            className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_#a78bfa] animate-pulse ml-1"
          />
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Sound toggle */}
          <button
            ref={soundBtnRef}
            id="soundBtn"
            title={isAudioMuted ? 'Unmute' : 'Mute Sound'}
            className={`w-9 h-9 rounded-full backdrop-blur-xl border flex items-center justify-center text-sm shadow-xl transition-all ${!isAudioMuted
              ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-cyan-500/30'
              : 'bg-neutral-950/65 border-white/15 text-neutral-300 hover:text-white'
              }`}
          >
            {isAudioMuted ? '🔇' : '🔊'}
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="w-9 h-9 rounded-full bg-neutral-950/65 backdrop-blur-xl border border-white/15 flex items-center justify-center text-xs text-neutral-300 hover:text-white shadow-xl transition-all"
          >
            {isFullscreen ? '✕' : '⛶'}
          </button>

          {/* HUD toggle */}
          <button
            onClick={() => setHudVisible(!hudVisible)}
            title="Toggle Controls"
            className="w-9 h-9 rounded-full bg-neutral-950/65 backdrop-blur-xl border border-white/15 flex items-center justify-center text-xs text-neutral-400 hover:text-white shadow-xl transition-all"
          >
            {hudVisible ? '👁' : '👁‍🗨'}
          </button>
        </div>
      </div>

      {/* Drawing Hint & Live Input */}
      {hudVisible && (
        <div className="absolute top-[60%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-30">
          <div className="pointer-events-none text-[11px] sm:text-xs text-amber-100/80 bg-black/50 backdrop-blur-md px-4 py-1 rounded-full border border-white/15 shadow-xl tracking-wide text-center">
            ✍️ Write &ldquo;Kadalamma Kalli&rdquo; on the sand · AI watches after you pause
          </div>

          <input
            id="liveSandInput"
            type="text"
            placeholder="...or type here to carve instantly"
            className="bg-black/20 text-white/90 placeholder-white/60 px-5 py-2.5 rounded-2xl backdrop-blur-md border border-white/20 text-center font-bold text-lg sm:text-xl outline-none focus:bg-black/40 focus:border-white/40 focus:shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all shadow-lg shadow-black/20"
            autoComplete="off"
            spellCheck="false"
          />
        </div>
      )}

      {/* Boy Counting Waves */}
      <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 flex flex-col items-center pointer-events-none z-20 select-none">
        <div className="relative">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/95 text-slate-800 px-3.5 py-1.5 rounded-2xl shadow-xl font-bold text-xs sm:text-sm whitespace-nowrap flex items-center gap-1.5 backdrop-blur-sm border border-slate-200">
            <span>Waves: {waveCount} 🌊</span>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 rotate-45 border-r border-b border-slate-200"></div>
          </div>
          <img
            src="/boy_ocean_transparent.png"
            alt="Boy sitting on rock facing ocean"
            className="w-36 h-auto sm:w-48 md:w-56 object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.35)]"
          />
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div
        ref={triggerBarRef}
        id="triggerBar"
        className={`absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 bg-neutral-950/85 backdrop-blur-2xl border border-white/15 py-2 px-3 sm:px-4 rounded-full shadow-2xl z-30 pointer-events-auto transition-all duration-300 ${hudVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
          }`}
      >
        <input
          ref={phraseInputRef}
          type="text"
          id="phraseInput"
          defaultValue="kadalamma kalli"
          placeholder="Type 'kadalamma kalli'"
          className="bg-transparent border-none outline-none text-xs sm:text-sm text-cyan-200 w-36 sm:w-52 placeholder:text-neutral-500 font-medium"
        />

        <button
          id="surgeBtn"
          className="bg-gradient-to-r from-teal-400 to-cyan-500 hover:from-teal-300 hover:to-cyan-400 text-neutral-950 px-4 sm:px-5 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-lg shadow-cyan-500/25 transition-all active:scale-95 whitespace-nowrap"
        >
          Surge Wave
        </button>

        <button
          id="autoCarveBtn"
          className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
        >
          Carve Preset
        </button>

        <button
          id="clearBtn"
          className="bg-white/10 hover:bg-white/20 text-neutral-300 border border-white/15 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
        >
          Clear
        </button>
      </div>

      {/* Debug Panel (lazy-loaded, toggled with D key) */}
      <React.Suspense fallback={null}>
        <DebugPanel
          detector={detectorInstance}
          visible={debugVisible}
          onToggle={toggleDebug}
        />
      </React.Suspense>
    </div>
  );
}
