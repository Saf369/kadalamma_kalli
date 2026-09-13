// Procedural Web Audio API sound generator for realistic ocean surf and wave surges
class OceanAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private surgeGain: GainNode | null = null;
  private surgeFilter: BiquadFilterNode | null = null;
  private foamGain: GainNode | null = null;
  private lfoOsc: OscillatorNode | null = null;

  private init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Pink/Brown noise buffer for realistic ocean roar
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
    }

    // Ambient ocean surf loop
    const ambientNoise = this.ctx.createBufferSource();
    ambientNoise.buffer = noiseBuffer;
    ambientNoise.loop = true;

    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
    this.ambientFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    // LFO for rhythmic tide swells
    this.lfoOsc = this.ctx.createOscillator();
    this.lfoOsc.frequency.setValueAtTime(0.12, this.ctx.currentTime); // ~8 sec ocean swell cycle
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(280, this.ctx.currentTime);

    this.lfoOsc.connect(lfoGain);
    lfoGain.connect(this.ambientFilter.frequency);

    ambientNoise.connect(this.ambientFilter);
    this.ambientFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);

    ambientNoise.start(0);
    this.lfoOsc.start(0);

    // Dynamic wave surge channel
    const surgeNoise = this.ctx.createBufferSource();
    surgeNoise.buffer = noiseBuffer;
    surgeNoise.loop = true;

    this.surgeFilter = this.ctx.createBiquadFilter();
    this.surgeFilter.type = 'lowpass';
    this.surgeFilter.frequency.setValueAtTime(200, this.ctx.currentTime);
    this.surgeFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    this.surgeGain = this.ctx.createGain();
    this.surgeGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    surgeNoise.connect(this.surgeFilter);
    this.surgeFilter.connect(this.surgeGain);
    this.surgeGain.connect(this.masterGain);
    surgeNoise.start(0);

    // Foam fizzle channel (highpass hiss of bubbling foam)
    const foamNoise = this.ctx.createBufferSource();
    foamNoise.buffer = noiseBuffer;
    foamNoise.loop = true;

    const foamFilter = this.ctx.createBiquadFilter();
    foamFilter.type = 'highpass';
    foamFilter.frequency.setValueAtTime(2400, this.ctx.currentTime);

    this.foamGain = this.ctx.createGain();
    this.foamGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    foamNoise.connect(foamFilter);
    foamFilter.connect(this.foamGain);
    this.foamGain.connect(this.masterGain);
    foamNoise.start(0);
  }

  public toggleMute(muted: boolean) {
    if (!this.ctx && !muted) {
      this.init();
    }
    if (this.ctx && this.masterGain) {
      if (this.ctx.state === 'suspended' && !muted) {
        this.ctx.resume();
      }
      const targetGain = muted ? 0.0001 : 0.35;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    }
  }

  public triggerSurgeSound(durationSec: number = 4.5) {
    if (!this.ctx) {
      this.init();
    }
    if (!this.ctx || !this.surgeGain || !this.surgeFilter || !this.foamGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;
    // Surge swell: deep roar rises as wave approaches shore
    this.surgeGain.gain.cancelScheduledValues(t);
    this.surgeGain.gain.setValueAtTime(0.0001, t);
    this.surgeGain.gain.exponentialRampToValueAtTime(0.65, t + durationSec * 0.4);
    this.surgeGain.gain.exponentialRampToValueAtTime(0.2, t + durationSec * 0.7);
    this.surgeGain.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

    // Filter sweeps up from deep roar to crashing surge
    this.surgeFilter.frequency.cancelScheduledValues(t);
    this.surgeFilter.frequency.setValueAtTime(250, t);
    this.surgeFilter.frequency.exponentialRampToValueAtTime(1400, t + durationSec * 0.35);
    this.surgeFilter.frequency.exponentialRampToValueAtTime(300, t + durationSec);

    // White foam fizzle peaks as foam washes over sand
    this.foamGain.gain.cancelScheduledValues(t);
    this.foamGain.gain.setValueAtTime(0.0001, t);
    this.foamGain.gain.exponentialRampToValueAtTime(0.35, t + durationSec * 0.45);
    this.foamGain.gain.exponentialRampToValueAtTime(0.15, t + durationSec * 0.8);
    this.foamGain.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);
  }
}

export const oceanAudio = new OceanAudioEngine();
