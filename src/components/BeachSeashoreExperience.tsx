'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { Canvas } from '@react-three/fiber';
import { SandCanvasManager } from './SandCanvasManager';
import { SeashoreScene } from './SeashoreScene';
import { oceanAudio } from './AudioEngine';
import {
  Waves,
  Sparkles,
  Volume2,
  VolumeX,
  Sun,
  Sunset,
  Trash2,
  Camera,
  CheckCircle2,
  Maximize2,
  Minimize2,
  PenTool,
} from 'lucide-react';

export default function BeachSeashoreExperience() {
  const [sandManager, setSandManager] = useState<SandCanvasManager | null>(null);
  const [isSurging, setIsSurging] = useState<boolean>(false);
  const [surgeTriggerSource, setSurgeTriggerSource] = useState<string>('');
  const [inputText, setInputText] = useState<string>('kadalamma kalli');
  const [matchedNotification, setMatchedNotification] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [timeOfDay, setTimeOfDay] = useState<'sunny' | 'sunset'>('sunny');
  const [cameraPreset, setCameraPreset] = useState<'drone' | 'shore' | 'horizon'>('drone');
  const [brushSize, setBrushSize] = useState<number>(24);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isCarvingAuto, setIsCarvingAuto] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  // Initialize SandCanvasManager on client side
  useEffect(() => {
    const manager = new SandCanvasManager(2048, 1152);
    setSandManager(manager);

    // Initial hint auto-carving after 600ms so user immediately sees the visual
    const timer = setTimeout(() => {
      setIsCarvingAuto(true);
      manager.autoCarveText('kadalamma kalli', () => {
        setIsCarvingAuto(false);
      });
    }, 600);

    return () => {
      clearTimeout(timer);
      manager.dispose();
    };
  }, []);

  // Update brush size
  const handleBrushChange = (size: number) => {
    setBrushSize(size);
    if (sandManager) {
      sandManager.setBrushSize(size);
    }
  };

  // Toggle audio
  const handleToggleAudio = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    oceanAudio.toggleMute(nextMuted);
  };

  // Trigger Wave Surge Animation
  const triggerWaveSurge = (source: string) => {
    if (isSurging) return;
    setIsSurging(true);
    setSurgeTriggerSource(source);

    // If audio was muted by default user action, warm up audio if user clicks sound
    if (!isAudioMuted) {
      oceanAudio.triggerSurgeSound(5.0);
    }

    setMatchedNotification(`🌊 Ocean wave surge triggered via ${source}! Foamy wash sweeping the shore...`);
  };

  // Handle Form / Trigger Condition Check
  const handleCheckAndTrigger = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanInput = inputText.trim().toLowerCase();

    if (cleanInput === 'kadalamma kalli') {
      setMatchedNotification("✨ Phrase matched: 'kadalamma kalli'! Ocean surge initiated!");
      triggerWaveSurge("'kadalamma kalli' text match");
    } else {
      setMatchedNotification(`🌊 Triggering surge for '${cleanInput}'...`);
      triggerWaveSurge("Submit button");
    }
  };

  // Auto-Carve 'kadalamma kalli' onto sand
  const handleAutoCarve = () => {
    if (!sandManager || isSurging || isCarvingAuto) return;
    setIsCarvingAuto(true);
    setMatchedNotification("✍️ Carving 'kadalamma kalli' into the damp sand...");

    sandManager.autoCarveText('kadalamma kalli', () => {
      setIsCarvingAuto(false);
      setMatchedNotification("✨ Finished carving 'kadalamma kalli'. Ready to surge!");
    });
  };

  // Surge finished handler
  const handleSurgeComplete = () => {
    startTransition(() => {
      setIsSurging(false);
      setMatchedNotification("🏖️ Wave receded: text dissolved completely into pristine, glossy wet sand.");
    });
  };

  // Clear sand manually
  const handleClear = () => {
    if (sandManager) {
      sandManager.clear();
      setMatchedNotification("Sand smoothed out.");
    }
  };

  // Toggle Fullscreen on the 16:9 container
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-3 sm:p-6 select-none font-sans">
      {/* Top Header / Title Bar */}
      <header className="w-full max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Waves className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-teal-200 via-cyan-100 to-amber-200 bg-clip-text text-transparent">
              Kadalamma Kalli Seashore
            </h1>
            <p className="text-xs text-neutral-400">
              Interactive 3D Sand Carving &amp; Ocean Wave Wash-Away Experience
            </p>
          </div>
        </div>

        {/* Quick Trigger Form (Requirement #2) */}
        <form onSubmit={handleCheckAndTrigger} className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 rounded-full px-3 py-1.5 shadow-xl backdrop-blur-md">
          <input
            id="sand-text-trigger-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type 'kadalamma kalli'"
            className="bg-transparent text-sm text-cyan-200 outline-none w-36 sm:w-44 px-2 placeholder:text-neutral-500 font-mono"
          />
          <button
            id="trigger-check-btn"
            type="submit"
            disabled={isSurging}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
              isSurging
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-neutral-950 shadow-md shadow-cyan-500/20 active:scale-95'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Check &amp; Surge
          </button>
        </form>
      </header>

      {/* 16:9 Laptop Cinematic Frame */}
      <div
        ref={containerRef}
        className="relative w-full max-w-6xl aspect-[16/9] rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-2xl shadow-cyan-950/40 flex flex-col group"
      >
        {/* 3D WebGL Canvas Viewport */}
        {sandManager ? (
          <Canvas
            camera={{ position: [0, 12.0, 12.5], fov: 42 }}
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            dpr={[1, 2]}
            className="w-full h-full cursor-crosshair"
          >
            <SeashoreScene
              sandManager={sandManager}
              isSurging={isSurging}
              onSurgeComplete={handleSurgeComplete}
              timeOfDay={timeOfDay}
              cameraPreset={cameraPreset}
            />
          </Canvas>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-sm">
            Initializing 3D Seashore...
          </div>
        )}

        {/* Status & Notification Toast Overlay */}
        {matchedNotification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-neutral-900/80 backdrop-blur-md border border-cyan-500/30 text-cyan-200 text-xs sm:text-sm px-4 py-2 rounded-full shadow-2xl pointer-events-none transition-all flex items-center gap-2 animate-fade-in z-20">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>{matchedNotification}</span>
          </div>
        )}

        {/* Floating Top-Right Tool Bar */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
          {/* Procedural Audio Button */}
          <button
            id="audio-toggle-btn"
            onClick={handleToggleAudio}
            title={isAudioMuted ? 'Turn Sound On (Surf & Swell Audio)' : 'Mute Sound'}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
              !isAudioMuted
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/20'
                : 'bg-neutral-900/70 border-neutral-700/60 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {!isAudioMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Time of Day Toggle */}
          <button
            id="time-of-day-btn"
            onClick={() => setTimeOfDay(timeOfDay === 'sunny' ? 'sunset' : 'sunny')}
            title={`Switch to ${timeOfDay === 'sunny' ? 'Golden Sunset' : 'Sunny Midday'}`}
            className="p-2 rounded-xl bg-neutral-900/70 backdrop-blur-md border border-neutral-700/60 text-neutral-300 hover:text-amber-300 transition-all"
          >
            {timeOfDay === 'sunny' ? <Sun className="w-4 h-4 text-amber-400" /> : <Sunset className="w-4 h-4 text-orange-400" />}
          </button>

          {/* Camera View Mode */}
          <button
            id="camera-preset-btn"
            onClick={() => {
              const presets: ('drone' | 'shore' | 'horizon')[] = ['drone', 'shore', 'horizon'];
              const nextIndex = (presets.indexOf(cameraPreset) + 1) % presets.length;
              setCameraPreset(presets[nextIndex]);
            }}
            title={`Camera: ${cameraPreset.toUpperCase()} (Click to toggle)`}
            className="p-2 rounded-xl bg-neutral-900/70 backdrop-blur-md border border-neutral-700/60 text-neutral-300 hover:text-cyan-300 transition-all flex items-center gap-1 text-xs"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline font-mono capitalize">{cameraPreset}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            id="fullscreen-toggle-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Cinema Fullscreen'}
            className="p-2 rounded-xl bg-neutral-900/70 backdrop-blur-md border border-neutral-700/60 text-neutral-300 hover:text-white transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Floating Bottom Carving & Action Controls HUD */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 z-20 pointer-events-none">
          {/* Drawing Tools (Left) */}
          <div className="flex items-center gap-2 bg-neutral-900/85 backdrop-blur-md border border-neutral-800/80 p-2 rounded-2xl shadow-xl pointer-events-auto">
            <div className="flex items-center gap-1.5 px-2 text-neutral-400 text-xs">
              <PenTool className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline font-medium">Carve:</span>
            </div>
            {/* Brush sizes */}
            {[16, 24, 38].map((size) => (
              <button
                key={size}
                id={`brush-size-${size}`}
                onClick={() => handleBrushChange(size)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  brushSize === size
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-md'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: size === 16 ? 4 : size === 24 ? 7 : 11, height: size === 16 ? 4 : size === 24 ? 7 : 11 }}
                />
              </button>
            ))}

            {/* Clear sand button */}
            <button
              id="clear-sand-btn"
              onClick={handleClear}
              title="Clear sand surface"
              className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-all ml-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Action Buttons (Right) */}
          <div className="flex items-center gap-2 bg-neutral-900/85 backdrop-blur-md border border-neutral-800/80 p-2 rounded-2xl shadow-xl pointer-events-auto">
            {/* Auto-carve "kadalamma kalli" button */}
            <button
              id="auto-carve-btn"
              onClick={handleAutoCarve}
              disabled={isCarvingAuto || isSurging}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-md ${
                isCarvingAuto
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 cursor-wait animate-pulse'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>{isCarvingAuto ? 'Carving...' : "Carve 'kadalamma kalli'"}</span>
            </button>

            {/* Ocean Wave Wash-Away Trigger Button */}
            <button
              id="surge-wave-btn"
              onClick={() => triggerWaveSurge("Wave Surge Button")}
              disabled={isSurging}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
                isSurging
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                  : 'bg-gradient-to-r from-teal-500 to-cyan-400 hover:from-teal-400 hover:to-cyan-300 text-neutral-950 shadow-cyan-500/25 active:scale-95'
              }`}
            >
              <Waves className={`w-4 h-4 ${isSurging ? 'animate-bounce' : ''}`} />
              <span>{isSurging ? 'Surging & Washing...' : 'Wash Away Wave'}</span>
            </button>
          </div>
        </div>

        {/* Freehand drawing hint overlay at the bottom */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none opacity-40 hover:opacity-75 transition-opacity text-[11px] text-neutral-300 bg-neutral-900/60 backdrop-blur-sm px-3 py-1 rounded-full border border-neutral-800">
          💡 Click and drag across the damp sand plane to carve freehand
        </div>
      </div>

      {/* Feature & Technical Highlights Footer */}
      <footer className="w-full max-w-6xl mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-neutral-400 px-2">
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3">
          <span className="font-semibold text-neutral-200 block mb-1">1. Sand Canvas Displacement</span>
          Offscreen 2048×1152 2D canvas with raycasted UV mapping, rendering dampened trench gouges, displaced sand rims, and normal disturbance.
        </div>
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3">
          <span className="font-semibold text-neutral-200 block mb-1">2. Trigger Condition</span>
          Detects the phrase <code className="text-cyan-300 bg-neutral-800 px-1 py-0.5 rounded font-mono">kadalamma kalli</code> via input check or dedicated one-click cursive carver.
        </div>
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3">
          <span className="font-semibold text-neutral-200 block mb-1">3. Wave Surge &amp; Erase Shader</span>
          Gerstner wave crest with procedural Voronoi seafoam rolls down, dissolves text directly under the foam front, and leaves glossy wet sand.
        </div>
      </footer>
    </main>
  );
}
