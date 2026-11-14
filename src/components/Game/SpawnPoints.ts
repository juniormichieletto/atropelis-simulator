export interface SpawnPoint {
  x: number;
  y: number;
  angle: number;
}

/**
 * Validated spawn points located in wide street centers across the city,
 * facing the natural road traffic direction.
 */
export const MULTIPLAYER_SPAWN_POINTS: SpawnPoint[] = [
  { x: 550, y: 850, angle: 0 },              // Central Midtown West (facing East)
  { x: 1250, y: 850, angle: Math.PI },        // Central Midtown East (facing West)
  { x: 450, y: 1950, angle: 0 },             // South Expressway West (facing East)
  { x: 1350, y: 1950, angle: Math.PI },       // South Expressway Center (facing West)
  { x: 2150, y: 1150, angle: -Math.PI / 2 },  // East Avenue Midtown (facing North)
  { x: 2150, y: 1850, angle: -Math.PI / 2 },  // East Avenue South (facing North)
  { x: 550, y: 1350, angle: 0 },             // Downtown West (facing East)
  { x: 1250, y: 1350, angle: Math.PI },       // Downtown East (facing West)
  { x: 50, y: 1050, angle: -Math.PI / 2 },    // West Coast Parkway North (facing North)
  { x: 50, y: 1650, angle: -Math.PI / 2 },    // West Coast Parkway South (facing North)
  { x: 950, y: 50, angle: 0 },               // North Highway (facing East)
  { x: 2350, y: 2450, angle: 0 },            // South Coast Boulevard (facing East)
];

/**
 * Deterministically shuffles the spawn points based on a random seed.
 * Because all clients in the same multiplayer match receive the identical seed,
 * the resulting shuffled list of locations is synchronized across all browsers.
 */
export function getShuffledSpawnPoints(seed: number): SpawnPoint[] {
  const points = [...MULTIPLAYER_SPAWN_POINTS];
  let s = Math.abs(seed) || 12345;
  const nextRandom = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  // Fisher-Yates shuffle
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    const temp = points[i];
    points[i] = points[j];
    points[j] = temp;
  }
  return points;
}

/**
 * Returns a distinct, randomized spawn point for a player slot.
 * Ensures slot 0, slot 1, slot 2, etc. receive completely different locations.
 */
export function getPlayerSpawnPoint(slotIndex: number, seed: number): SpawnPoint {
  const shuffled = getShuffledSpawnPoints(seed);
  const index = Math.abs(slotIndex) % shuffled.length;
  return shuffled[index];
}
