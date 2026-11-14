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

  it('saves, retrieves, and clears multiplayer scores independently of solo scores', () => {
    LocalStorageService.saveName('VIPER');
    LocalStorageService.saveScore(100);

    LocalStorageService.saveMultiplayerScore(50, 2, 4);
    LocalStorageService.saveMultiplayerScore(85, 1, 3);

    const soloScores = LocalStorageService.getScores();
    const mpScores = LocalStorageService.getMultiplayerScores();

    expect(soloScores.length).toBe(1);
    expect(soloScores[0].points).toBe(100);

    expect(mpScores.length).toBe(2);
    expect(mpScores[0].points).toBe(85);
    expect(mpScores[0].rank).toBe(1);
    expect(mpScores[0].playersCount).toBe(3);
    expect(mpScores[0].name).toBe('VIPER');

    expect(mpScores[1].points).toBe(50);
    expect(mpScores[1].rank).toBe(2);

    LocalStorageService.clearMultiplayerScores();
    expect(LocalStorageService.getMultiplayerScores()).toEqual([]);
    // Solo scores should remain untouched
    expect(LocalStorageService.getScores().length).toBe(1);

    // Corrupted JSON in multiplayer storage
    localStorage.setItem('atropelis_mp_scores', 'bad-data');
    expect(LocalStorageService.getMultiplayerScores()).toEqual([]);
  });
});
