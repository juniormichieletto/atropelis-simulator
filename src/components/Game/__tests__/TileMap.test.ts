import { describe, it, expect, vi } from 'vitest';
import { TileMap } from '../TileMap';

describe('TileMap', () => {
  it('generates a 25x30 city grid with expected tile types', () => {
    const map = new TileMap();
    expect(map.rows).toBe(25);
    expect(map.cols).toBe(30);
    expect(map.grid.length).toBe(25);
    expect(map.grid[0].length).toBe(30);

    // Verify specific tiles from layout
    expect(map.grid[0][0]).toBe('SAND');
    expect(map.grid[0][8]).toBe('ROAD');
    expect(map.grid[3][5]).toBe('BUILDING');
    expect(map.grid[1][8]).toBe('SIDEWALK');
    expect(map.grid[0][25]).toBe('GRASS');
    expect(map.grid[21][23]).toBe('WATER');
  });

  it('detects collisions accurately for buildings, water, and map boundaries', () => {
    const map = new TileMap();

    // Out of bounds collides
    expect(map.isColliding(-10, 100)).toBe(true);
    expect(map.isColliding(100, -10)).toBe(true);
    expect(map.isColliding(3500, 100)).toBe(true);
    expect(map.isColliding(100, 2600)).toBe(true);

    // Building tile (row 3, col 5 -> x=550, y=350) collides
    expect(map.isColliding(550, 350)).toBe(true);

    // Water tile (row 21, col 23 -> x=2350, y=2150) collides
    expect(map.isColliding(2350, 2150)).toBe(true);

    // Road tile (row 8, col 5 -> x=550, y=850) does not collide
    expect(map.isColliding(550, 850)).toBe(false);
    expect(map.isColliding(550, 850, 15)).toBe(false);

    // Point just outside building at (x=500, y=350) collides when hull radius=15 overlaps building at x>=500
    expect(map.isColliding(492, 350, 15)).toBe(true);
  });

  it('renders Mode 7 sky and ground plane without errors', () => {
    const map = new TileMap();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const drawImageSpy = vi.spyOn(ctx, 'drawImage');

    map.drawSkyAndGround(ctx, 450, 850, 0, 52, 270, 832, 1280, 720);
    expect(drawImageSpy).toHaveBeenCalled();
  });

  it('projects visible 3D buildings and roadside neon props within the camera frustum', () => {
    const map = new TileMap();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Looking East along road at (450, 850) where buildings and sidewalks are visible ahead
    const drawables = map.getVisibleBuildingDrawables(450, 850, 0, 52, 270, 832, 1280);
    expect(drawables.length).toBeGreaterThan(0);

    for (const d of drawables) {
      expect(d.depth).toBeGreaterThan(0);
      d.draw(ctx);
    }
  });

  it('renders the radar minimap using cached offscreen buffer and returns scale factors', () => {
    const map = new TileMap();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const drawImageSpy = vi.spyOn(ctx, 'drawImage');

    const { scaleX, scaleY } = map.drawMinimap(ctx, 10, 10, 150, 150);
    expect(scaleX).toBeCloseTo(150 / 3000);
    expect(scaleY).toBeCloseTo(150 / 2500);
    expect(drawImageSpy).toHaveBeenCalledTimes(1);

    // Calling again at same dimensions reuses cached minimap surface
    map.drawMinimap(ctx, 10, 10, 150, 150);
    expect(drawImageSpy).toHaveBeenCalledTimes(2);
  });
});
