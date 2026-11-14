import { describe, it, expect } from 'vitest';
import {
  MULTIPLAYER_SPAWN_POINTS,
  getShuffledSpawnPoints,
  getPlayerSpawnPoint,
} from '../SpawnPoints';
import { TileMap } from '../TileMap';

describe('SpawnPoints', () => {
  const tileMap = new TileMap();

  it('ensures every defined spawn point is valid, safe, and does not collide with buildings or water', () => {
    expect(MULTIPLAYER_SPAWN_POINTS.length).toBeGreaterThanOrEqual(8);

    for (const pt of MULTIPLAYER_SPAWN_POINTS) {
      // Must be within map bounds (cols: 30 * 100 = 3000, rows: 25 * 100 = 2500)
      expect(pt.x).toBeGreaterThan(0);
      expect(pt.x).toBeLessThan(3000);
      expect(pt.y).toBeGreaterThan(0);
      expect(pt.y).toBeLessThan(2500);

      // Must not collide with building/water hulls (radius 20)
      const collides = tileMap.isColliding(pt.x, pt.y, 20);
      expect(collides).toBe(false);
    }
  });

  it('shuffles spawn points deterministically with the same seed and differently with different seeds', () => {
    const seedA = 481516;
    const seedB = 234299;

    const listA1 = getShuffledSpawnPoints(seedA);
    const listA2 = getShuffledSpawnPoints(seedA);
    const listB = getShuffledSpawnPoints(seedB);

    expect(listA1).toEqual(listA2);
    expect(listA1).not.toEqual(listB);
  });

  it('guarantees players in different slots in the same match receive completely separate locations', () => {
    const matchSeed = 998877;
    const player0Spawn = getPlayerSpawnPoint(0, matchSeed);
    const player1Spawn = getPlayerSpawnPoint(1, matchSeed);
    const player2Spawn = getPlayerSpawnPoint(2, matchSeed);

    // Position coordinates must not match
    expect(player0Spawn.x !== player1Spawn.x || player0Spawn.y !== player1Spawn.y).toBe(true);
    expect(player1Spawn.x !== player2Spawn.x || player1Spawn.y !== player2Spawn.y).toBe(true);

    // Distance between player 0 and player 1 must be large (safe separation > 300 world units)
    const distP0P1 = Math.hypot(player0Spawn.x - player1Spawn.x, player0Spawn.y - player1Spawn.y);
    expect(distP0P1).toBeGreaterThan(300);

    const distP1P2 = Math.hypot(player1Spawn.x - player2Spawn.x, player1Spawn.y - player2Spawn.y);
    expect(distP1P2).toBeGreaterThan(300);
  });

  it('handles negative or large slot indices safely via modulo', () => {
    const seed = 555;
    const p0 = getPlayerSpawnPoint(0, seed);
    const pWrapped = getPlayerSpawnPoint(MULTIPLAYER_SPAWN_POINTS.length, seed);
    expect(p0).toEqual(pWrapped);
  });
});
