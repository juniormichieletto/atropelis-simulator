class SoundService {
  private audioCtx: AudioContext | null = null;

  private init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playHitSound(type: 'PERSON' | 'BIKE' | 'MOTORCYCLE' | 'CAR' | 'WALL') {
    this.init();
    if (!this.audioCtx) return;

    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;

    switch (type) {
      case 'PERSON':
        // High-pitched "thud/squeak"
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        break;
      case 'BIKE':
      case 'MOTORCYCLE':
        // Metallic "clank"
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;
      case 'CAR':
      case 'WALL':
        // Deep "crunch" (noise-like)
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(100, now);
        oscillator.frequency.exponentialRampToValueAtTime(20, now + 0.3);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;
    }
  }
}

export const soundService = new SoundService();
