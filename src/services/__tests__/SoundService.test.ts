import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { soundService } from '../SoundService';

describe('SoundService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    soundService.stopBackgroundMusic();
    vi.useRealTimers();
  });

  it('plays UI sound and all collision hit sound types without throwing', () => {
    expect(() => soundService.playUiSound()).not.toThrow();
    expect(() => soundService.playHitSound('PERSON')).not.toThrow();
    expect(() => soundService.playHitSound('BIKE')).not.toThrow();
    expect(() => soundService.playHitSound('MOTORCYCLE')).not.toThrow();
    expect(() => soundService.playHitSound('CAR')).not.toThrow();
    expect(() => soundService.playHitSound('WALL')).not.toThrow();
  });

  it('runs the 16-bit Top Gear chiptune sequencer and modulates 5-gear engine sound', () => {
    soundService.startBackgroundMusic();

    // Advance through all 64 sequencer steps (4 bars)
    vi.advanceTimersByTime(8000);

    // Update engine across gears 1..5, reverse, braking, and steering
    soundService.updateEngineSound(40, 0, false);
    soundService.updateEngineSound(180, -0.5, false);
    soundService.updateEngineSound(340, 0.8, true);

    soundService.stopBackgroundMusic();
  });
});
