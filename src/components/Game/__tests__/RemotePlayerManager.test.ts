import { describe, it, expect } from 'vitest';
import { RemotePlayerManager } from '../RemotePlayerManager';
import type { PlayerNetworkData } from '../../../services/MultiplayerService';

describe('RemotePlayerManager', () => {
  it('creates and smoothly interpolates remote player positions', () => {
    const manager = new RemotePlayerManager();
    const packet1: PlayerNetworkData = {
      id: 'p_123',
      name: 'Rival Racer',
      color: '#e74c3c',
      x: 100,
      y: 200,
      angle: 0,
      speed: 120,
      steerVisual: 0,
      isBraking: false,
      score: 15,
      timestamp: Date.now(),
    };

    manager.updateFromNetwork(packet1);
    expect(manager.players.size).toBe(1);

    const player = manager.players.get('p_123')!;
    expect(player.name).toBe('Rival Racer');
    expect(player.x).toBe(100);
    expect(player.y).toBe(200);

    // Receive new target position
    manager.updateFromNetwork({
      ...packet1,
      x: 150,
      y: 250,
    });

    expect(player.targetX).toBe(150);
    expect(player.targetY).toBe(250);

    // Step simulation
    manager.update(0.1);
    expect(player.x).toBeGreaterThan(100);
    expect(player.y).toBeGreaterThan(200);
  });

  it('detects collisions between local player and remote vehicles', () => {
    const manager = new RemotePlayerManager();
    manager.updateFromNetwork({
      id: 'p_999',
      name: 'Bumper',
      color: '#00e5ff',
      x: 450,
      y: 850,
      angle: 0,
      speed: 0,
      steerVisual: 0,
      isBraking: false,
      score: 0,
      timestamp: Date.now(),
    });

    // Close collision
    const hit = manager.checkCollisionWithPlayer(455, 855, 24);
    expect(hit).not.toBeNull();
    expect(hit?.name).toBe('Bumper');

    // Far away does not collide
    const miss = manager.checkCollisionWithPlayer(100, 100, 24);
    expect(miss).toBeNull();
  });

  it('generates 3D drawables within the camera frustum', () => {
    const manager = new RemotePlayerManager();
    manager.updateFromNetwork({
      id: 'p_ahead',
      name: 'Leader',
      color: '#ffbe0b',
      x: 550, // 100 units ahead along X
      y: 850,
      angle: 0,
      speed: 100,
      steerVisual: 0,
      isBraking: false,
      score: 50,
      timestamp: Date.now(),
    });

    const drawables = manager.getVisibleDrawables(
      450, // camX
      850, // camY
      0,   // camAngle (facing East)
      52,  // camHeight
      270, // horizonY
      832, // focalLength
      1280 // canvasWidth
    );

    expect(drawables.length).toBe(1);
    expect(drawables[0].depth).toBeCloseTo(100, 0);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    expect(() => drawables[0].draw(ctx)).not.toThrow();
  });

  it('draws remote players on the minimap', () => {
    const manager = new RemotePlayerManager();
    manager.updateFromNetwork({
      id: 'p_mini',
      name: 'Radar Blip',
      color: '#3a86ff',
      x: 400,
      y: 400,
      angle: 0,
      speed: 50,
      steerVisual: 0,
      isBraking: false,
      score: 10,
      timestamp: Date.now(),
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    expect(() => manager.drawMinimap(ctx, 1000, 20, 0.05, 0.05)).not.toThrow();
  });
});
