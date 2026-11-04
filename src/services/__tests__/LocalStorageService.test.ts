import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageService } from '../LocalStorageService';

describe('LocalStorageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and retrieves pilot name', () => {
    expect(LocalStorageService.getName()).toBeNull();
    LocalStorageService.saveName('MAVERICK');
    expect(LocalStorageService.getName()).toBe('MAVERICK');
  });

  it('saves scores sorted descending and clears scores', () => {
    LocalStorageService.saveName('PILOT1');
    LocalStorageService.saveScore(15);
    LocalStorageService.saveScore(42);
    LocalStorageService.saveScore(8);

    const scores = LocalStorageService.getScores();
    expect(scores.length).toBe(3);
    expect(scores.map(s => s.points)).toEqual([42, 15, 8]);
    expect(scores[0].name).toBe('PILOT1');

    LocalStorageService.clearScores();
    expect(LocalStorageService.getScores()).toEqual([]);
  });

  it('handles corrupted localStorage JSON gracefully', () => {
    localStorage.setItem('atropelis_scores', '{invalid-json');
    expect(LocalStorageService.getScores()).toEqual([]);
  });
});
