class SoundService {
  private audioCtx: AudioContext | null = null;
  private musicInterval: number | null = null;
  private isMusicPlaying = false;
  private isMusicPaused = false;
  private noiseBuffer: AudioBuffer | null = null;

  // Continuous engine sound nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private init() {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.createNoiseBuffer();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private createNoiseBuffer() {
    if (!this.audioCtx) return;
    const bufferSize = this.audioCtx.sampleRate * 0.5;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  playUiSound() {
    this.init();
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(783.99, now + 0.045); // G5
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.11);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  playHitSound(type: 'PERSON' | 'BIKE' | 'MOTORCYCLE' | 'CAR' | 'WALL') {
    this.init();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;

    switch (type) {
      case 'PERSON': {
        // 16-bit impact + arcade point pickup chime
        this.playNoiseBurst(now, 0.08, 900, 0.2);
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.05); // A5
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }
      case 'BIKE':
      case 'MOTORCYCLE': {
        // Metallic crunch + high-score rising arpeggio chime
        this.playNoiseBurst(now, 0.14, 1400, 0.25);
        const notes = type === 'MOTORCYCLE' ? [587.33, 783.99, 1174.66] : [523.25, 659.25, 987.77];
        notes.forEach((freq, idx) => {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'square';
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          const t = now + idx * 0.045;
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.16, t);
          gain.gain.exponentialRampToValueAtTime(0.008, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
        });
        break;
      }
      case 'CAR':
      case 'WALL': {
        // Heavy Top Gear collision crunch + low bass thud
        this.playNoiseBurst(now, 0.26, 450, 0.38);
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.28);
        gain.gain.setValueAtTime(0.38, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
        break;
      }
    }
  }

  /**
   * Updates the continuous Top Gear 3000 style dual-oscillator engine hum & gear pitch.
   */
  updateEngineSound(speed: number, steerAmount: number = 0, isBraking: boolean = false) {
    if (!this.audioCtx || !this.isMusicPlaying) return;

    if (!this.engineOsc1 || !this.engineOsc2 || !this.engineGain || !this.engineFilter) {
      this.startEngineNodes();
    }
    if (!this.engineOsc1 || !this.engineOsc2 || !this.engineGain || !this.engineFilter) return;

    const now = this.audioCtx.currentTime;
    const absSpeed = Math.abs(speed);

    // Simulate 5-speed transmission RPM curve like Top Gear 3000
    const gearSpans = [75, 145, 220, 295, 400];
    let gear = 0;
    while (gear < gearSpans.length - 1 && absSpeed > gearSpans[gear]) {
      gear++;
    }
    const prevSpan = gear === 0 ? 0 : gearSpans[gear - 1];
    const gearProgress = (absSpeed - prevSpan) / (gearSpans[gear] - prevSpan);

    // Base frequency climbs with gear & RPM
    const baseFreq = 38 + gear * 11 + gearProgress * 42 + absSpeed * 0.08;
    const subFreq = baseFreq * 0.5;

    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.engineOsc2.frequency.setTargetAtTime(subFreq, now, 0.04);

    // Open filter as speed increases; slight pitch/filter bite when braking or cornering hard
    const cutoff = 180 + absSpeed * 2.8 + (isBraking ? 250 : 0) + Math.abs(steerAmount) * 120;
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);

    const targetGain = 0.045 + Math.min(0.065, (absSpeed / 380) * 0.065);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
  }

  private startEngineNodes() {
    if (!this.audioCtx) return;
    this.stopEngineNodes();

    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const filter = this.audioCtx.createBiquadFilter();
    const gain = this.audioCtx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 3.5;

    gain.gain.value = 0.04;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc1.start();
    osc2.start();

    this.engineOsc1 = osc1;
    this.engineOsc2 = osc2;
    this.engineFilter = filter;
    this.engineGain = gain;
  }

  private stopEngineNodes() {
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.engineOsc1?.disconnect();
      this.engineOsc2?.disconnect();
      this.engineFilter?.disconnect();
      this.engineGain?.disconnect();
    } catch {
      // Ignore already-stopped nodes
    }
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
  }

  /**
   * Starts a 16-bit Top Gear 3000 inspired high-energy chiptune racing soundtrack!
   */
  startBackgroundMusic() {
    this.init();
    if (!this.audioCtx || this.isMusicPlaying) return;
    this.isMusicPaused = false;
    this.isMusicPlaying = true;
    this.startEngineNodes();

    let step = 0; // 16th-note step counter (64 steps = 4 bars)
    const bpm = 138; // Fast Top Gear arcade tempo
    const stepTime = 60 / bpm / 4; // 16th note duration in seconds

    // 4-bar chord progression in D minor (Dm -> Bb -> C -> A)
    // Bass root frequencies (Hz) for each bar (16 steps per bar)
    const bassRoots = [73.42, 58.27, 65.41, 55.0]; // D2, Bb1, C2, A1

    // Top Gear style arpeggio chords (3-note triads per bar, Hz)
    const arpChords = [
      [293.66, 349.23, 440.0], // Dm: D4, F4, A4
      [233.08, 293.66, 349.23], // Bb: Bb3, D4, F4
      [261.63, 329.63, 392.0], // C:  C4, E4, G4
      [220.0, 277.18, 329.63], // A:  A3, C#4, E4
    ];

    // Heroic 64-step lead synth melody (0 = rest/sustain)
    const leadMelody: number[] = [
      // Bar 1 (Dm)
      587.33, 0, 587.33, 659.25, 698.46, 0, 659.25, 587.33,
      523.25, 0, 440.0, 0, 587.33, 0, 0, 0,
      // Bar 2 (Bb)
      466.16, 0, 466.16, 523.25, 587.33, 0, 698.46, 0,
      659.25, 0, 587.33, 523.25, 440.0, 0, 0, 0,
      // Bar 3 (C)
      523.25, 0, 523.25, 587.33, 659.25, 0, 783.99, 0,
      698.46, 659.25, 587.33, 0, 659.25, 0, 0, 0,
      // Bar 4 (A)
      698.46, 0, 659.25, 0, 587.33, 0, 523.25, 0,
      554.37, 0, 659.25, 0, 880.0, 0, 739.99, 659.25,
    ];

    this.musicInterval = window.setInterval(() => {
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const bar = Math.floor(step / 16) % 4;
      const stepInBar = step % 16;

      // 1. Drums: Driving 16-bit breakbeat
      if (stepInBar % 4 === 0 || stepInBar === 10) {
        this.playKick(now);
      }
      if (stepInBar === 4 || stepInBar === 12) {
        this.playSnare(now);
      }
      if (stepInBar % 2 === 0) {
        this.playHat(now, stepInBar % 4 === 2 ? 0.05 : 0.025);
      }

      // 2. Galloping 16th-note octave synth bass (classic SNES racing bassline)
      const root = bassRoots[bar];
      const isOctave = stepInBar % 2 === 1;
      const bassFreq = isOctave ? root * 2 : root;
      if (stepInBar !== 7 && stepInBar !== 15) {
        this.playBass(now, bassFreq, stepTime * 0.85);
      }

      // 3. Rapid 16-bit Chiptune Arpeggio
      const chord = arpChords[bar];
      const arpFreq = chord[step % 3];
      this.playArp(now, arpFreq, stepTime * 0.8);

      // 4. Heroic Top Gear Lead Melody
      const leadFreq = leadMelody[step];
      if (leadFreq > 0) {
        this.playLead(now, leadFreq, stepTime * 1.9);
      }

      step = (step + 1) % 64;
    }, stepTime * 1000);
  }

  private stopMusicLoop() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.stopEngineNodes();
    this.isMusicPlaying = false;
  }

  stopBackgroundMusic() {
    this.stopMusicLoop();
    this.isMusicPaused = false;
  }

  /**
   * Pauses background music, engine oscillators, and suspends the AudioContext
   * when the browser tab becomes hidden or loses focus.
   */
  pauseBackgroundMusic() {
    if (!this.isMusicPlaying) return;
    this.isMusicPaused = true;
    this.stopMusicLoop();
    this.audioCtx?.suspend?.();
  }

  /**
   * Resumes background music and AudioContext when returning to the active tab.
   */
  resumeBackgroundMusic() {
    if (!this.isMusicPaused) return;
    this.isMusicPaused = false;
    this.audioCtx?.resume?.();
    this.startBackgroundMusic();
  }

  private playNoiseBurst(time: number, duration: number, filterFreq: number, volume: number) {
    if (!this.audioCtx || !this.noiseBuffer) return;
    const source = this.audioCtx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, time);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    source.start(time);
    source.stop(time + duration);
  }

  private playKick(time: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(32, time + 0.14);
    gain.gain.setValueAtTime(0.38, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.16);

    osc.start(time);
    osc.stop(time + 0.16);
  }

  private playSnare(time: number) {
    if (!this.audioCtx) return;
    // Crisp 16-bit noise snare + punchy body
    this.playNoiseBurst(time, 0.13, 1800, 0.18);

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.setValueAtTime(210, time);
    osc.frequency.exponentialRampToValueAtTime(90, time + 0.09);
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    osc.start(time);
    osc.stop(time + 0.1);
  }

  private playHat(time: number, volume: number) {
    this.playNoiseBurst(time, 0.035, 7500, volume);
  }

  private playBass(time: number, freq: number, duration: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const filter = this.audioCtx.createBiquadFilter();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.13, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playArp(time: number, freq: number, duration: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.035, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playLead(time: number, freq: number, duration: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'square';
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    // Slight vibrato / pitch slide for authentic SNES SPC700 lead feel
    osc.frequency.setValueAtTime(freq * 0.992, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.025);

    gain.gain.setValueAtTime(0.085, time);
    gain.gain.exponentialRampToValueAtTime(0.008, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }
}

export const soundService = new SoundService();
