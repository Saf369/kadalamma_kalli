import * as THREE from 'three';

export interface CarvePoint {
  x: number;
  y: number;
}

export class SandCanvasManager {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  public width: number = 2048;
  public height: number = 1152;
  private lastPoint: CarvePoint | null = null;
  public brushSize: number = 24;
  private isAutoCarving: boolean = false;
  private autoCarveAnimId: number | null = null;
  public drawnStrokeCount: number = 0;

  constructor(width: number = 2048, height: number = 1152) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not obtain 2D canvas context');
    }
    this.ctx = context;

    // Initially transparent canvas - transparent means smooth untouched sand
    this.clear();

    // Three.js dynamic canvas texture
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
  }

  public clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawnStrokeCount = 0;
    this.lastPoint = null;
    if (this.texture) {
      this.texture.needsUpdate = true;
    }
  }

  public setBrushSize(size: number) {
    this.brushSize = Math.max(8, Math.min(60, size));
  }

  // Draw a realistic carved stroke in damp sand
  public carveStroke(p1: CarvePoint, p2: CarvePoint, radius: number = this.brushSize) {
    const ctx = this.ctx;
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(1, Math.ceil(dist / (radius * 0.25)));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = p1.x + (p2.x - p1.x) * t;
      const cy = p1.y + (p2.y - p1.y) * t;

      // 1. Outer raised sand ridge highlight (displaced damp sand around the gouge)
      ctx.beginPath();
      ctx.arc(cx, cy - 2, radius * 1.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(235, 212, 178, 0.08)';
      ctx.fill();

      // 2. Main trench shadow (dark damp sand exposed beneath surface)
      const grad = ctx.createRadialGradient(cx, cy + 3, radius * 0.1, cx, cy, radius);
      grad.addColorStop(0, 'rgba(38, 22, 12, 0.95)'); // Deep shadow core
      grad.addColorStop(0.5, 'rgba(56, 33, 17, 0.85)'); // Shadowed trench wall
      grad.addColorStop(0.85, 'rgba(85, 52, 28, 0.45)'); // Trench slope
      grad.addColorStop(1, 'rgba(110, 75, 42, 0)'); // Falloff

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // 3. Crisp inner carved gouge line
      ctx.beginPath();
      ctx.arc(cx, cy + 2, radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(24, 14, 8, 0.6)';
      ctx.fill();

      // 4. Occasional sand pebble/grain scatter for tactile realism
      if (Math.random() < 0.2) {
        const angle = Math.random() * Math.PI * 2;
        const scatterDist = radius * (1.0 + Math.random() * 0.5);
        const sx = cx + Math.cos(angle) * scatterDist;
        const sy = cy + Math.sin(angle) * scatterDist;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(240, 220, 185, 0.7)' : 'rgba(35, 20, 10, 0.6)';
        ctx.fill();
      }
    }

    this.drawnStrokeCount++;
    this.texture.needsUpdate = true;
  }

  // Pointer move mapping from 3D UV to Canvas coordinates
  public handlePointer(uv: THREE.Vector2, isDown: boolean) {
    if (this.isAutoCarving) return;

    // UV in Three.js: (0,0) bottom-left, (1,1) top-right
    // Canvas: (0,0) top-left, (width, height) bottom-right
    const currentPoint: CarvePoint = {
      x: uv.x * this.width,
      y: (1.0 - uv.y) * this.height,
    };

    if (!isDown) {
      this.lastPoint = null;
      return;
    }

    if (this.lastPoint) {
      this.carveStroke(this.lastPoint, currentPoint);
    } else {
      this.carveStroke(currentPoint, currentPoint);
    }

    this.lastPoint = currentPoint;
  }

  // Wave wash-away erasure synchronized with the ocean surge progress
  // foamFrontNorm: 0.0 at top (ocean) down to 1.0 at bottom (shore)
  public washAwaySweep(foamFrontNorm: number) {
    if (foamFrontNorm <= 0.01) return;

    const ctx = this.ctx;
    const washY = foamFrontNorm * this.height;

    // Use 'destination-out' to seamlessly erase the carved strokes where foam reaches
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    // Wash area completely above the foam line
    if (washY >= this.height * 0.98) {
      ctx.fillRect(0, 0, this.width, this.height);
      this.drawnStrokeCount = 0;
    } else {
      // Solid erase block above the foam crest
      ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
      ctx.fillRect(0, 0, this.width, Math.max(0, washY - 40));

      // Turbulent, foaming dissolution gradient right at the wave crest front
      const grad = ctx.createLinearGradient(0, Math.max(0, washY - 40), 0, washY + 40);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.8)');
      grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.4)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, Math.max(0, washY - 40), this.width, 80);
    }

    ctx.restore();
    this.texture.needsUpdate = true;
  }

  // Animated procedural auto-carver for "kadalamma kalli"
  public autoCarveText(text: string = 'kadalamma kalli', onComplete?: () => void) {
    if (this.isAutoCarving) return;
    this.clear();
    this.isAutoCarving = true;

    // Create an offscreen path for handwriting rendering
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      this.isAutoCarving = false;
      return;
    }

    // Measure and render cursive text onto the temp canvas
    tempCtx.fillStyle = '#ffffff';
    tempCtx.font = 'bold 92px "Brush Script MT", "Caveat", "Segoe Script", "Dancing Script", cursive, sans-serif';
    tempCtx.textAlign = 'center';
    tempCtx.textBaseline = 'middle';

    // Position in lower-middle sand area (approx UV y: 0.35 to 0.48)
    const textCenterX = this.width * 0.5;
    const textCenterY = this.height * 0.62;

    tempCtx.fillText(text, textCenterX, textCenterY);

    // Read pixel data to sample carve coordinates
    const imgData = tempCtx.getImageData(0, 0, this.width, this.height);
    const pixels = imgData.data;

    const strokePoints: CarvePoint[] = [];
    // Collect non-empty pixels with density sampling
    for (let y = Math.floor(textCenterY - 90); y < textCenterY + 90; y += 4) {
      for (let x = Math.floor(textCenterX - 550); x < textCenterX + 550; x += 4) {
        const index = (y * this.width + x) * 4;
        if (pixels[index + 3] > 120) {
          strokePoints.push({ x: x + (Math.random() - 0.5) * 2, y: y + (Math.random() - 0.5) * 2 });
        }
      }
    }

    // Sort points into natural writing left-to-right flow with cluster ordering
    strokePoints.sort((a, b) => {
      const colDiff = a.x - b.x;
      if (Math.abs(colDiff) > 30) return colDiff;
      return a.y - b.y;
    });

    let index = 0;
    const pointsPerFrame = Math.max(12, Math.floor(strokePoints.length / 90)); // ~1.5 - 2s animation
    let lastPt: CarvePoint | null = null;

    const step = () => {
      const target = Math.min(strokePoints.length, index + pointsPerFrame);
      for (let i = index; i < target; i++) {
        const pt = strokePoints[i];
        if (lastPt && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) < 45) {
          this.carveStroke(lastPt, pt, 14);
        } else {
          this.carveStroke(pt, pt, 14);
        }
        lastPt = pt;
      }
      index = target;

      if (index < strokePoints.length) {
        this.autoCarveAnimId = requestAnimationFrame(step);
      } else {
        this.isAutoCarving = false;
        this.drawnStrokeCount = strokePoints.length;
        if (onComplete) onComplete();
      }
    };

    this.autoCarveAnimId = requestAnimationFrame(step);
  }

  public cancelAutoCarve() {
    if (this.autoCarveAnimId) {
      cancelAnimationFrame(this.autoCarveAnimId);
      this.autoCarveAnimId = null;
    }
    this.isAutoCarving = false;
  }

  public dispose() {
    this.cancelAutoCarve();
    this.texture.dispose();
  }
}
