class SoundService {
  private audioCtx: AudioContext | null = null;
  private musicInterval: number | null = null;
  private isMusicPlaying = false;
  private isMusicPaused = false;
  private noiseBuffer: AudioBuffer | null = null;

  // Continuous multi-harmonic car engine sound nodes
  private engineOsc1: OscillatorNode | null = null; // Primary firing fundamental (sawtooth)
  private engineOsc2: OscillatorNode | null = null; // Cylinder harmonic growl (1.5x sawtooth)
  private engineOsc3: OscillatorNode | null = null; // Deep exhaust sub-rumble (0.5x triangle)
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
        // Satisfying soft impact thump + warm retro arcade score chime
        this.playNoiseBurst(now, 0.1, 420, 0.28, 'lowpass');
        this.playImpactThud(now, 160, 55, 0.12, 0.25);

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.045); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }
      case 'BIKE': {
        // Lightweight bicycle frame impact + rim deformation ping
        this.playNoiseBurst(now, 0.15, 1350, 0.32, 'bandpass', 2.2);
        this.playImpactThud(now, 240, 65, 0.16, 0.28);

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.frequency.setValueAtTime(1046.5, now); // C6 bell/rim ping
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }
      case 'MOTORCYCLE': {
        // High-speed superbike frame crunch + fairing shatter + rewarding harmonic chime
        this.playNoiseBurst(now, 0.22, 920, 0.38, 'bandpass', 1.8);
        this.playNoiseBurst(now + 0.01, 0.14, 2800, 0.24, 'highpass');
        this.playImpactThud(now, 210, 48, 0.24, 0.36);

        [880, 1318.51].forEach((freq, idx) => {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          const t = now + idx * 0.035;
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.14, t);
          gain.gain.exponentialRampToValueAtTime(0.005, t + 0.18);
          osc.start(t);
          osc.stop(t + 0.18);
        });
        break;
      }
      case 'CAR': {
        // Visceral automotive multi-layer crash: heavy metal crumple, chassis thud & skid
        this.playImpactThud(now, 160, 32, 0.34, 0.48);
        this.playNoiseBurst(now, 0.3, 480, 0.44, 'lowpass', 1.8);
        this.playNoiseBurst(now, 0.24, 1200, 0.32, 'bandpass', 1.5);
        this.playNoiseBurst(now + 0.02, 0.18, 3600, 0.18, 'highpass');

        // Screech / metal friction transient
        const skid = this.audioCtx.createOscillator();
        const skidFilter = this.audioCtx.createBiquadFilter();
        const skidGain = this.audioCtx.createGain();
        skid.type = 'sawtooth';
        skidFilter.type = 'bandpass';
        skidFilter.frequency.setValueAtTime(850, now);
        skidFilter.Q.value = 2.5;
        skid.frequency.setValueAtTime(720, now);
        skid.frequency.exponentialRampToValueAtTime(380, now + 0.18);
        skidGain.gain.setValueAtTime(0.13, now);
        skidGain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);
        skid.connect(skidFilter);
        skidFilter.connect(skidGain);
        skidGain.connect(this.audioCtx.destination);
        skid.start(now);
        skid.stop(now + 0.18);
        break;
      }
      case 'WALL': {
        // Massive concrete barrier slam with low-frequency shockwave & debris crunch
        this.playImpactThud(now, 190, 24, 0.38, 0.58);
        this.playNoiseBurst(now, 0.34, 380, 0.48, 'lowpass', 2.0);
        this.playNoiseBurst(now + 0.02, 0.16, 2200, 0.22, 'bandpass', 1.2);
        break;
      }
    }
  }

  /**
   * Updates the continuous multi-harmonic sports-car engine purr, 5-speed RPM curve,
   * and exhaust filter resonance.
   */
  updateEngineSound(speed: number, steerAmount: number = 0, isBraking: boolean = false) {
    if (!this.audioCtx || !this.isMusicPlaying) return;

    if (!this.engineOsc1 || !this.engineOsc2 || !this.engineOsc3 || !this.engineGain || !this.engineFilter) {
      this.startEngineNodes();
    }
    if (!this.engineOsc1 || !this.engineOsc2 || !this.engineOsc3 || !this.engineGain || !this.engineFilter) return;

    const now = this.audioCtx.currentTime;
    const absSpeed = Math.abs(speed);

    // 5-speed transmission RPM curve (realistic rev climb & shift drop per gear)
    const gearSpans = [75, 145, 220, 295, 400];
    let gear = 0;
    while (gear < gearSpans.length - 1 && absSpeed > gearSpans[gear]) {
      gear++;
    }
    const prevSpan = gear === 0 ? 0 : gearSpans[gear - 1];
    const gearProgress = Math.max(0, Math.min(1, (absSpeed - prevSpan) / (gearSpans[gear] - prevSpan)));

    // Warm V6/V8 fundamental (42 Hz idle -> ~135 Hz redline), plus 5th-harmonic growl & sub-rumble
    const rpmFactor = isBraking ? Math.max(0.15, gearProgress * 0.72) : gearProgress;
    const baseFreq = 42 + gear * 9 + rpmFactor * 48 + absSpeed * 0.05;
    const harmonicFreq = baseFreq * 1.503; // Slight detune on 5th harmonic gives authentic multi-cylinder purr
    const subFreq = baseFreq * 0.5;

    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.055);
    this.engineOsc2.frequency.setTargetAtTime(harmonicFreq, now, 0.055);
    this.engineOsc3.frequency.setTargetAtTime(subFreq, now, 0.055);

    // Warm lowpass exhaust resonance opens smoothly with throttle/RPM
    const cutoff = 155 + gear * 45 + rpmFactor * 260 + Math.abs(steerAmount) * 65 - (isBraking ? 60 : 0);
    this.engineFilter.frequency.setTargetAtTime(Math.max(120, cutoff), now, 0.06);

    const targetGain = 0.042 + Math.min(0.052, (absSpeed / 380) * 0.052);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.06);
  }

  private startEngineNodes() {
    if (!this.audioCtx) return;
    this.stopEngineNodes();

    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const osc3 = this.audioCtx.createOscillator();
    const osc2Gain = this.audioCtx.createGain();
    const osc3Gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();
    const gain = this.audioCtx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc3.type = 'triangle';
    osc1.frequency.value = 44;
    osc2.frequency.value = 66;
    osc3.frequency.value = 22;

    osc2Gain.gain.value = 0.36; // Subtle harmonic growl
    osc3Gain.gain.value = 0.75; // Deep exhaust sub-thump

    filter.type = 'lowpass';
    filter.frequency.value = 175;
    filter.Q.value = 1.4; // Warm, non-nasal resonance

    gain.gain.value = 0.042;

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    osc3.connect(osc3Gain);
    osc3Gain.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc1.start();
    osc2.start();
    osc3.start();

    this.engineOsc1 = osc1;
    this.engineOsc2 = osc2;
    this.engineOsc3 = osc3;
    this.engineFilter = filter;
    this.engineGain = gain;
  }

  private stopEngineNodes() {
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.engineOsc3?.stop();
      this.engineOsc1?.disconnect();
      this.engineOsc2?.disconnect();
      this.engineOsc3?.disconnect();
      this.engineFilter?.disconnect();
      this.engineGain?.disconnect();
    } catch {
      // Ignore already-stopped nodes
    }
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineOsc3 = null;
    this.engineFilter = null;
    this.engineGain = null;
  }

  /**
   * Starts a warm, driving Top Gear 3000 / Need for Speed inspired synthwave-rock soundtrack!
   */
  startBackgroundMusic() {
    this.init();
    if (!this.audioCtx || this.isMusicPlaying) return;
    this.isMusicPaused = false;
    this.isMusicPlaying = true;
    this.startEngineNodes();

    let step = 0; // 16th-note step counter (128 steps = 8 bars)
    const bpm = 126; // Driving highway synthwave / electronic-rock groove
    const stepTime = 60 / bpm / 4; // 16th note duration in seconds

    // 8-bar E minor progression: Em -> Em -> C -> D -> Em -> Em -> G -> Bm
    const bassRoots = [82.41, 82.41, 65.41, 73.42, 82.41, 82.41, 98.0, 61.74];

    // Warm power-chord pads (root + fifth)
    const padChords: [number, number][] = [
      [164.81, 246.94], // Em
      [164.81, 246.94], // Em
      [130.81, 196.0],  // C
      [146.83, 220.0],  // D
      [164.81, 246.94], // Em
      [164.81, 246.94], // Em
      [196.0, 293.66],  // G
      [123.47, 185.0],  // Bm
    ];

    // Rolling NFS-style 16th-note bass rhythm (1 = root, 2 = octave jump, 0 = rest)
    const bassPattern = [1, 0, 1, 1, 1, 0, 2, 0, 1, 0, 1, 1, 1, 0, 2, 0];

    // Soaring, spacious Top Gear 3000 / Outrun synth lead melody (0 = rest/sustain)
    const leadMelody: number[] = [
      // Bar 1 (Em)
      329.63, 0, 0, 0, 493.88, 0, 0, 440.0, 392.0, 0, 0, 0, 369.99, 0, 329.63, 0,
      // Bar 2 (Em)
      0, 0, 329.63, 0, 392.0, 0, 440.0, 0, 493.88, 0, 0, 0, 0, 0, 0, 0,
      // Bar 3 (C)
      523.25, 0, 0, 0, 493.88, 0, 440.0, 0, 392.0, 0, 0, 0, 440.0, 0, 493.88, 0,
      // Bar 4 (D)
      587.33, 0, 0, 0, 493.88, 0, 440.0, 0, 369.99, 0, 0, 0, 0, 0, 392.0, 440.0,
      // Bar 5 (Em - lifted octave peak)
      659.25, 0, 0, 0, 587.33, 0, 493.88, 0, 659.25, 0, 0, 587.33, 493.88, 0, 440.0, 0,
      // Bar 6 (Em)
      392.0, 0, 440.0, 0, 493.88, 0, 0, 0, 659.25, 0, 0, 0, 0, 0, 0, 0,
      // Bar 7 (G)
      783.99, 0, 0, 0, 739.99, 0, 659.25, 0, 587.33, 0, 0, 0, 493.88, 0, 587.33, 0,
      // Bar 8 (Bm -> turnaround)
      739.99, 0, 0, 0, 587.33, 0, 493.88, 0, 440.0, 0, 392.0, 0, 369.99, 0, 0, 0,
    ];

    this.musicInterval = window.setInterval(() => {
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const bar = Math.floor(step / 16) % 8;
      const stepInBar = step % 16;

      // 1. Punchy electronic-rock breakbeat drums
      if (stepInBar === 0 || stepInBar === 6 || stepInBar === 10 || ((bar === 3 || bar === 7) && stepInBar === 14)) {
        this.playKick(now);
      }
      if (stepInBar === 4 || stepInBar === 12) {
        this.playSnare(now);
      }
      if (stepInBar % 2 === 0) {
        this.playHat(now, stepInBar % 4 === 2 ? 0.028 : 0.015);
      }

      // 2. Warm rolling synthwave bassline
      const bassStep = bassPattern[stepInBar];
      if (bassStep > 0) {
        const root = bassRoots[bar];
        const bassFreq = bassStep === 2 ? root * 2 : root;
        this.playBass(now, bassFreq, stepTime * 1.1);
      }

      // 3. Wide, soft atmospheric power-chord pad on bar starts & turnaround hits
      if (stepInBar === 0 || ((bar === 3 || bar === 7) && stepInBar === 10)) {
        this.playPad(now, padChords[bar], stepTime * 10);
      }

      // 4. Warm filtered synth lead melody
      const leadFreq = leadMelody[step];
      if (leadFreq > 0) {
        // Hold longer when followed by rests for smooth singing sustain
        let sustainSteps = 1;
        while (sustainSteps < 4 && leadMelody[(step + sustainSteps) % 128] === 0) {
          sustainSteps++;
        }
        this.playLead(now, leadFreq, stepTime * Math.max(1.4, sustainSteps * 0.92));
      }

      step = (step + 1) % 128;
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

  private playNoiseBurst(
    time: number,
    duration: number,
    filterFreq: number,
    volume: number,
    filterType: BiquadFilterType = 'bandpass',
    q: number = 1.0
  ) {
    if (!this.audioCtx || !this.noiseBuffer) return;
    const source = this.audioCtx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, time);
    filter.Q.value = q;

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    source.start(time);
    source.stop(time + duration);
  }

  private playImpactThud(
    time: number,
    startFreq: number,
    endFreq: number,
    duration: number,
    volume: number
  ) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playKick(time: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.setValueAtTime(118, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.14);
    gain.gain.setValueAtTime(0.26, time);
    gain.gain.exponentialRampToValueAtTime(0.008, time + 0.16);

    osc.start(time);
    osc.stop(time + 0.16);
  }

  private playSnare(time: number) {
    if (!this.audioCtx) return;
    // Tight electronic-rock snare with soft body
    this.playNoiseBurst(time, 0.12, 1450, 0.11);

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.setValueAtTime(185, time);
    osc.frequency.exponentialRampToValueAtTime(88, time + 0.08);
    gain.gain.setValueAtTime(0.13, time);
    gain.gain.exponentialRampToValueAtTime(0.008, time + 0.09);

    osc.start(time);
    osc.stop(time + 0.09);
  }

  private playHat(time: number, volume: number) {
    this.playNoiseBurst(time, 0.03, 6200, volume);
  }

  private playBass(time: number, freq: number, duration: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const filter = this.audioCtx.createBiquadFilter();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, time);
    filter.frequency.exponentialRampToValueAtTime(135, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.105, time);
    gain.gain.exponentialRampToValueAtTime(0.008, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playPad(time: number, chord: [number, number], duration: number) {
    if (!this.audioCtx) return;
    const filter = this.audioCtx.createBiquadFilter();
    const gain = this.audioCtx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, time);
    filter.frequency.exponentialRampToValueAtTime(340, time + duration);

    gain.gain.setValueAtTime(0.005, time);
    gain.gain.exponentialRampToValueAtTime(0.034, time + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.004, time + duration);

    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    chord.forEach((freq, idx) => {
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration);
    });
  }

  private playLead(time: number, freq: number, duration: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const filter = this.audioCtx.createBiquadFilter();
    const gain = this.audioCtx.createGain();

    // Warm filtered analog sawtooth lead (smooth Top Gear 3000 / synthwave tone)
    osc.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, time);
    filter.frequency.exponentialRampToValueAtTime(880, time + duration);
    filter.Q.value = 1.2;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.frequency.setValueAtTime(freq * 0.994, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.035);

    gain.gain.setValueAtTime(0.008, time);
    gain.gain.exponentialRampToValueAtTime(0.062, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.006, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  }
}

export const soundService = new SoundService();
