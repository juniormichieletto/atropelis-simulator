import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { soundService } from '../SoundService';

describe('SoundService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    soundService.setMuted(false);
    localStorage.clear();
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

  it('runs the synthwave-rock Top Gear 3000 sequencer and modulates 5-gear engine sound', () => {
    soundService.startBackgroundMusic();

    // Advance through all 128 sequencer steps (8 bars)
    vi.advanceTimersByTime(16000);

    // Update engine across gears 1..5, reverse, braking, and steering
    soundService.updateEngineSound(40, 0, false);
    soundService.updateEngineSound(180, -0.5, false);
    soundService.updateEngineSound(340, 0.8, true);

    soundService.stopBackgroundMusic();
  });

  it('pauses and resumes background music, engine nodes, and AudioContext on tab visibility changes', () => {
    soundService.startBackgroundMusic();
    const ctx = (soundService as unknown as { audioCtx: AudioContext }).audioCtx;

    vi.advanceTimersByTime(500);
    expect(ctx.createOscillator).toHaveBeenCalled();

    vi.mocked(ctx.createOscillator).mockClear();
    vi.mocked(ctx.suspend).mockClear();

    soundService.pauseBackgroundMusic();
    expect(ctx.suspend).toHaveBeenCalledTimes(1);

    // Sequencer interval must not allocate audio nodes while paused
    vi.advanceTimersByTime(1000);
    expect(ctx.createOscillator).not.toHaveBeenCalled();

    vi.mocked(ctx.resume).mockClear();
    soundService.resumeBackgroundMusic();
    expect(ctx.resume).toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(ctx.createOscillator).toHaveBeenCalled();

    // After explicit stop, resumeBackgroundMusic should remain a no-op
    soundService.stopBackgroundMusic();
    vi.mocked(ctx.resume).mockClear();
    vi.mocked(ctx.createOscillator).mockClear();
    soundService.resumeBackgroundMusic();
    expect(ctx.resume).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('persists mute state and suppresses UI, hit, engine, and music audio while muted', () => {
    soundService.startBackgroundMusic();
    const ctx = (soundService as unknown as { audioCtx: AudioContext }).audioCtx;
    vi.mocked(ctx.createOscillator).mockClear();

    expect(soundService.isMuted()).toBe(false);
    const muted = soundService.toggleMute();
    expect(muted).toBe(true);
    expect(localStorage.getItem('atropelis_muted')).toBe('true');

    soundService.playUiSound();
    soundService.playHitSound('PERSON');
    soundService.updateEngineSound(200, 0, false);
    vi.advanceTimersByTime(500);
    expect(ctx.createOscillator).not.toHaveBeenCalled();

    const unmuted = soundService.toggleMute();
    expect(unmuted).toBe(false);
    expect(localStorage.getItem('atropelis_muted')).toBe('false');
    // Unmuting while music is playing restarts engine oscillators
    expect(ctx.createOscillator).toHaveBeenCalled();
  });
});
