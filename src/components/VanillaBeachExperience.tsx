'use client';

import React, { useEffect, useRef, useState } from 'react';

const TARGET_PHRASE = 'kadalamma kalli';
const VIDEO_SRC = '/i_need_the_seashore_be_exactly.mp4';

// Sand region boundary in percentage of video height (sand is below 45% from top)
const SAND_TOP_RATIO = 0.45;

export default function VanillaBeachExperience() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const triggerBarRef = useRef<HTMLDivElement>(null);
  const phraseInputRef = useRef<HTMLInputElement>(null);
  const soundBtnRef = useRef<HTMLButtonElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

    // --- OFFSCREEN DRAWING CANVAS (1600x900) ---
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Draw realistic carved trench in the video sand
    function drawCarvedLine(x1: number, y1: number, x2: number, y2: number, radius = 9) {
      if (!drawCtx) return;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(dist / 2.5));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = x1 + (x2 - x1) * t;
        const cy = y1 + (y2 - y1) * t;

        // 1. Sunlit displaced sand rim highlight (upper left)
        drawCtx.beginPath();
        drawCtx.arc(cx - 3, cy - 3, radius * 1.3, 0, Math.PI * 2);
        drawCtx.fillStyle = 'rgba(248, 232, 204, 0.28)';
        drawCtx.fill();

        // 2. Dark trench shadow (moist gouge shadow - lower right)
        drawCtx.beginPath();
        drawCtx.arc(cx + 2.5, cy + 2.5, radius * 1.05, 0, Math.PI * 2);
        drawCtx.fillStyle = 'rgba(38, 20, 8, 0.85)';
        drawCtx.fill();

        // 3. Deep inner gouge core
        drawCtx.beginPath();
        drawCtx.arc(cx + 1, cy + 1, radius * 0.5, 0, Math.PI * 2);
        drawCtx.fillStyle = 'rgba(20, 9, 3, 0.96)';
        drawCtx.fill();

        // 4. Sand grain speckles
        if (Math.random() < 0.15) {
          const ang = Math.random() * Math.PI * 2;
          const sDist = radius * (1.1 + Math.random() * 0.4);
          drawCtx.beginPath();
          drawCtx.arc(cx + Math.cos(ang) * sDist, cy + Math.sin(ang) * sDist, 1.2, 0, Math.PI * 2);
          drawCtx.fillStyle = Math.random() > 0.5 ? 'rgba(240, 220, 185, 0.65)' : 'rgba(30, 15, 5, 0.7)';
          drawCtx.fill();
        }
      }
    }

    function getCanvasCoords(e: MouseEvent | TouchEvent) {
      if (!container || !drawCanvas) return { x: 0, y: 0, normY: 0 };
      const rect = container.getBoundingClientRect();
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      return {
        x: nx * drawCanvas.width,
        y: ny * drawCanvas.height,
        normY: ny, // 0 at top, 1 at bottom
      };
    }

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#triggerBar') || target.closest('#topHud')) return;
      const pt = getCanvasCoords(e);
      if (pt.normY < SAND_TOP_RATIO) return; // Restrict drawing to sand region only
      isDrawing = true;
      lastX = pt.x;
      lastY = pt.y;
      drawCarvedLine(pt.x, pt.y, pt.x, pt.y);
    };

    const onPointerMove = (e: MouseEvent) => {
      if (!isDrawing) return;
      const pt = getCanvasCoords(e);
      if (pt.normY < SAND_TOP_RATIO) {
        isDrawing = false;
        return;
      }
      drawCarvedLine(lastX, lastY, pt.x, pt.y);
      lastX = pt.x;
      lastY = pt.y;
    };

    const onPointerUp = () => { isDrawing = false; };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Auto-carve cursive preset for "kadalamma kalli"
    function autoCarveText(text = TARGET_PHRASE) {
      if (!drawCanvas) return;
      const temp = document.createElement('canvas');
      temp.width = drawCanvas.width;
      temp.height = drawCanvas.height;
      const tctx = temp.getContext('2d');
      if (!tctx) return;

      tctx.fillStyle = '#fff';
      tctx.font = 'bold 96px "Brush Script MT", "Segoe Script", "Dancing Script", cursive, sans-serif';
      tctx.textAlign = 'center';
      tctx.textBaseline = 'middle';

      const cx = temp.width * 0.5;
      const cy = temp.height * 0.74; // Lower sand area
      tctx.fillText(text, cx, cy);

      const pData = tctx.getImageData(0, 0, temp.width, temp.height).data;
      const points: { x: number; y: number }[] = [];
      for (let y = cy - 80; y < cy + 80; y += 4) {
        for (let x = cx - 540; x < cx + 540; x += 4) {
          if (pData[(y * temp.width + x) * 4 + 3] > 100) {
            points.push({ x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2 });
          }
        }
      }

      points.sort((a, b) => {
        const dx = a.x - b.x;
        return Math.abs(dx) > 28 ? dx : a.y - b.y;
      });

      let idx = 0;
      let prev: { x: number; y: number } | null = null;
      let animId: number;

      function step() {
        const batch = Math.min(points.length, idx + 22);
        for (let i = idx; i < batch; i++) {
          const pt = points[i];
          if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 48) {
            drawCarvedLine(prev.x, prev.y, pt.x, pt.y, 8);
          } else {
            drawCarvedLine(pt.x, pt.y, pt.x, pt.y, 8);
          }
          prev = pt;
        }
        idx = batch;
        if (idx < points.length) {
          animId = requestAnimationFrame(step);
        }
      }
      step();
    }

    const initialCarveTimer = setTimeout(() => {
      autoCarveText(TARGET_PHRASE);
    }, 500);

    // --- DESTRUCTIVE CANVAS ERASE SYNCHRONIZED WITH VIDEO WAVE ---
    // Video surge timeline: wave rolls down beach from 0.8s to 3.5s of video
    function eraseCanvasWithWaveFront(progress: number) {
      if (!drawCtx || !drawCanvas) return;
      if (progress <= 0.01) return;

      // Start of sand in canvas Y = 0.45 * height; max wash Y = 0.92 * height
      const startY = 0.45 * drawCanvas.height;
      const targetY = 0.92 * drawCanvas.height;
      const currentWashY = startY + (targetY - startY) * Math.min(1.0, progress);

      drawCtx.save();
      drawCtx.globalCompositeOperation = 'destination-out';

      // Solid clear above wave front
      drawCtx.fillStyle = 'rgba(0, 0, 0, 1.0)';
      drawCtx.fillRect(0, 0, drawCanvas.width, Math.max(0, currentWashY - 40));

      // Feathered linear gradient along surging foam front
      const grad = drawCtx.createLinearGradient(0, Math.max(0, currentWashY - 40), 0, currentWashY + 40);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.85)');
      grad.addColorStop(0.9, 'rgba(0, 0, 0, 0.35)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

      drawCtx.fillStyle = grad;
      drawCtx.fillRect(0, Math.max(0, currentWashY - 40), drawCanvas.width, 80);

      drawCtx.restore();
    }

    // Monitor video time update to synchronize the wash-away
    const onTimeUpdate = () => {
      if (!video) return;
      const curTime = video.currentTime;

      // Wave surge happens between 0.8s and 3.4s in i_need_the_seashore_be_exactly.mp4
      if (curTime >= 0.8 && curTime <= 3.4) {
        const surgeProgress = (curTime - 0.8) / 2.4; // 0 -> 1
        eraseCanvasWithWaveFront(surgeProgress);
      } else if (curTime > 3.4 && curTime <= 4.0) {
        // Complete sweep at peak wash
        eraseCanvasWithWaveFront(1.0);
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);

    // Audio Toggle
    const onSoundToggle = () => {
      if (!video) return;
      const nextMuted = !video.muted;
      video.muted = nextMuted;
      setIsAudioMuted(nextMuted);
      soundBtn.textContent = nextMuted ? '🔇' : '🔊';
    };
    soundBtn.addEventListener('click', onSoundToggle);

    // Trigger Surge Button / Form Submit
    function triggerSurge() {
      if (!video) return;
      setStatusMessage("🌊 Wave surge rushing over the shore!");
      // Seek video to the start of the surge wave (0.8s) and play
      video.currentTime = 0.8;
      video.play().catch(() => {});

      setTimeout(() => {
        setStatusMessage("🏖️ Wave receded: text washed away into pristine smooth wet sand.");
        setTimeout(() => setStatusMessage(null), 3000);
      }, 4000);
    }

    function checkAndTrigger() {
      const val = phraseInput?.value.trim().toLowerCase();
      if (val === TARGET_PHRASE) {
        triggerSurge();
      } else {
        triggerBar?.classList.remove('shake');
        void triggerBar?.offsetWidth;
        triggerBar?.classList.add('shake');
        setStatusMessage(`Type '${TARGET_PHRASE}' to trigger wave surge`);
        setTimeout(() => setStatusMessage(null), 2500);
      }
    }

    const surgeBtn = document.getElementById('surgeBtn');
    const autoCarveBtn = document.getElementById('autoCarveBtn');
    const clearBtn = document.getElementById('clearBtn');

    const onSurgeClick = () => checkAndTrigger();
    const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Enter') checkAndTrigger(); };
    const onAutoCarve = () => {
      autoCarveText(TARGET_PHRASE);
      setStatusMessage("✍️ Carving 'kadalamma kalli' into the sand...");
      setTimeout(() => setStatusMessage(null), 2000);
    };
    const onClear = () => {
      if (!drawCtx || !drawCanvas) return;
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    };

    surgeBtn?.addEventListener('click', onSurgeClick);
    phraseInput.addEventListener('keydown', onKeydown);
    autoCarveBtn?.addEventListener('click', onAutoCarve);
    clearBtn?.addEventListener('click', onClear);

    return () => {
      clearTimeout(initialCarveTimer);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      video.removeEventListener('timeupdate', onTimeUpdate);
      soundBtn.removeEventListener('click', onSoundToggle);
      surgeBtn?.removeEventListener('click', onSurgeClick);
      phraseInput.removeEventListener('keydown', onKeydown);
      autoCarveBtn?.removeEventListener('click', onAutoCarve);
      clearBtn?.removeEventListener('click', onClear);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-black select-none cursor-crosshair flex items-center justify-center"
    >
      {/* Exact High-Definition Seashore Video Background */}
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* Interactive Sand Carving Layer overlaid directly on the video sand */}
      <canvas
        ref={drawCanvasRef}
        width={1600}
        height={900}
        className="absolute inset-0 w-full h-full object-cover pointer-events-auto mix-blend-multiply opacity-95"
      />

      {/* Status Toast Notification */}
      {statusMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-neutral-950/80 backdrop-blur-md border border-cyan-400/30 text-cyan-200 text-xs sm:text-sm px-4 py-2 rounded-full shadow-2xl z-40 animate-fade-in pointer-events-none">
          {statusMessage}
        </div>
      )}

      {/* Top HUD */}
      <div
        id="topHud"
        className={`absolute top-4 left-6 right-6 flex justify-between items-center pointer-events-none z-30 transition-opacity duration-300 ${
          hudVisible ? 'opacity-100' : 'opacity-20 hover:opacity-100'
        }`}
      >
        <div className="flex items-center gap-2.5 bg-neutral-950/65 backdrop-blur-xl border border-white/15 px-4 py-2 rounded-full shadow-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse" />
          <span className="text-xs sm:text-sm font-bold tracking-wide text-white">
            Kadalamma Kalli Shore
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Sound toggle button */}
          <button
            ref={soundBtnRef}
            id="soundBtn"
            title={isAudioMuted ? 'Unmute Real Ocean Surf Sound' : 'Mute Sound'}
            className={`w-9 h-9 rounded-full backdrop-blur-xl border flex items-center justify-center text-sm shadow-xl transition-all ${
              !isAudioMuted
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-cyan-500/30'
                : 'bg-neutral-950/65 border-white/15 text-neutral-300 hover:text-white'
            }`}
          >
            {isAudioMuted ? '🔇' : '🔊'}
          </button>

          {/* Fullscreen toggle button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="w-9 h-9 rounded-full bg-neutral-950/65 backdrop-blur-xl border border-white/15 flex items-center justify-center text-xs text-neutral-300 hover:text-white shadow-xl transition-all"
          >
            {isFullscreen ? '✕' : '⛶'}
          </button>

          {/* Toggle HUD visibility */}
          <button
            onClick={() => setHudVisible(!hudVisible)}
            title="Toggle Controls Visibility"
            className="w-9 h-9 rounded-full bg-neutral-950/65 backdrop-blur-xl border border-white/15 flex items-center justify-center text-xs text-neutral-400 hover:text-white shadow-xl transition-all"
          >
            {hudVisible ? '👁' : '👁‍🗨'}
          </button>
        </div>
      </div>

      {/* Gentle Drawing Hint */}
      {hudVisible && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none text-[11px] sm:text-xs text-amber-100/80 bg-black/50 backdrop-blur-md px-4 py-1 rounded-full border border-white/15 shadow-xl tracking-wide">
          ✍️ Click &amp; drag across the sand to carve freehand
        </div>
      )}

      {/* Floating Bottom Control Pill */}
      <div
        ref={triggerBarRef}
        id="triggerBar"
        className={`absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 bg-neutral-950/85 backdrop-blur-2xl border border-white/15 py-2 px-3 sm:px-4 rounded-full shadow-2xl z-30 pointer-events-auto transition-all duration-300 ${
          hudVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
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
    </div>
  );
}
