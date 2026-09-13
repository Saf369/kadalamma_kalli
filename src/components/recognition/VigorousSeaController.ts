/**
 * VigorousSeaController
 *
 * Controls visual and behavioural responses in VanillaBeachExperience
 * when "Kadalamma Kalli" is detected by the AI pipeline.
 *
 * Responsibilities:
 * - Manage "vigorous" vs "idle" sea state.
 * - Animate a CSS/canvas foam particle overlay for the build-up phase.
 * - Drive a configurable dramatic transition before triggering the actual surge.
 * - Expose a `trigger()` method and a `reset()` method.
 * - Remain decoupled from the recognizer — call trigger() from the event handler.
 */

export type SeaState = 'idle' | 'buildUp' | 'vigorous' | 'receding';

export interface VigorousSeaControllerOptions {
  /** The background video element. */
  videoEl: HTMLVideoElement;
  /** The container div wrapping the entire experience. */
  containerEl: HTMLDivElement;
  /** The drawing canvas (to schedule text erasure). */
  drawCanvas: HTMLCanvasElement;
  /** The drawing canvas context (for erasure sweep). */
  drawCtx: CanvasRenderingContext2D;
  /** Called when the controller wants the host to trigger the video surge. */
  onTriggerSurge: () => void;
  /** Called when the vigorous sequence fully completes. */
  onComplete?: () => void;
}

// ─── Foam particle type ───────────────────────────────────────────────────────

interface FoamParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class VigorousSeaController {
  private state: SeaState = 'idle';
  private opts: VigorousSeaControllerOptions;

  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private animId: number | null = null;
  private particles: FoamParticle[] = [];
  private buildUpStart = 0;
  private buildUpDuration = 1800; // ms before triggering actual video surge

  constructor(opts: VigorousSeaControllerOptions) {
    this.opts = opts;
  }

  /** Return current sea state. */
  get currentState(): SeaState {
    return this.state;
  }

  /**
   * Trigger the vigorous sea sequence.
   * Safe to call multiple times — ignored if already vigorous.
   */
  trigger(): void {
    if (this.state !== 'idle') return;
    this.state = 'buildUp';
    this.buildUpStart = performance.now();

    this._createOverlay();
    this._applyVigorousClass();
    this._startParticleLoop();

    // After build-up duration, trigger the actual surge
    setTimeout(() => {
      if (this.state === 'buildUp') {
        this.state = 'vigorous';
        this.opts.onTriggerSurge();

        // After surge animation, start receding
        setTimeout(() => {
          this._beginRecede();
        }, 5000);
      }
    }, this.buildUpDuration);
  }

  /** Reset back to idle state immediately. */
  reset(): void {
    this._stopParticleLoop();
    this._removeOverlay();
    this._removeVigorousClass();
    this.state = 'idle';
    this.particles = [];
  }

  // ─── Overlay canvas ─────────────────────────────────────────────────────

  private _createOverlay(): void {
    if (this.overlayCanvas) return;

    const overlay = document.createElement('canvas');
    overlay.width = this.opts.drawCanvas.width;
    overlay.height = this.opts.drawCanvas.height;
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
      mix-blend-mode: screen;
    `;
    overlay.id = 'vigorousSeaOverlay';
    this.opts.containerEl.appendChild(overlay);
    this.overlayCanvas = overlay;
    this.overlayCtx = overlay.getContext('2d')!;
  }

  private _removeOverlay(): void {
    if (this.overlayCanvas) {
      this.overlayCanvas.remove();
      this.overlayCanvas = null;
      this.overlayCtx = null;
    }
  }

  // ─── CSS vigorous class ─────────────────────────────────────────────────

  private _applyVigorousClass(): void {
    this.opts.containerEl.classList.add('vigorous-sea');
    this.opts.videoEl.classList.add('vigorous-sea-video');
  }

  private _removeVigorousClass(): void {
    this.opts.containerEl.classList.remove('vigorous-sea');
    this.opts.videoEl.classList.remove('vigorous-sea-video');
  }

  // ─── Foam particle system ───────────────────────────────────────────────

  private _spawnParticle(): FoamParticle {
    const cw = this.overlayCanvas!.width;
    const ch = this.overlayCanvas!.height;

    // Spawn along the top portion (ocean side) and rush down toward the text
    return {
      x: Math.random() * cw,
      y: ch * 0.38 + Math.random() * ch * 0.08,
      vx: (Math.random() - 0.5) * 3,
      vy: 3.5 + Math.random() * 4.5, // rushing downward
      radius: 3 + Math.random() * 8,
      alpha: 0.6 + Math.random() * 0.4,
      life: 0,
      maxLife: 60 + Math.random() * 80,
    };
  }

  private _startParticleLoop(): void {
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (this.state === 'idle') return;

      const dt = now - lastTime;
      lastTime = now;

      const ctx = this.overlayCtx;
      const canvas = this.overlayCanvas;
      if (!ctx || !canvas) return;

      // Fade out previous frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn new particles during build-up and vigorous phases
      if (this.state === 'buildUp' || this.state === 'vigorous') {
        const spawnRate = this.state === 'vigorous' ? 6 : 3;
        for (let i = 0; i < spawnRate; i++) {
          this.particles.push(this._spawnParticle());
        }
      }

      // Update and draw particles
      this.particles = this.particles.filter((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        // Turbulent jitter
        p.vx += (Math.random() - 0.5) * 0.8;
        p.vy += Math.random() * 0.3; // slight acceleration

        const lifeRatio = p.life / p.maxLife;
        const currentAlpha = p.alpha * (1 - lifeRatio);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 240, 255, ${currentAlpha.toFixed(3)})`;
        ctx.fill();

        return p.life < p.maxLife && p.y < canvas.height;
      });

      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  private _stopParticleLoop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  // ─── Recede sequence ────────────────────────────────────────────────────

  private _beginRecede(): void {
    this.state = 'receding';

    // Fade out the vigorous CSS classes gradually
    setTimeout(() => {
      this._removeVigorousClass();
    }, 500);

    setTimeout(() => {
      this._stopParticleLoop();
      this._removeOverlay();
      this.state = 'idle';
      this.particles = [];
      if (this.opts.onComplete) this.opts.onComplete();
    }, 2000);
  }

  dispose(): void {
    this.reset();
  }
}
