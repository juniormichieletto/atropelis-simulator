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

  it('freezes score, marks as disconnected, and ignores collisions on markDisconnected', () => {
    const manager = new RemotePlayerManager();
    manager.updateFromNetwork({
      id: 'p_dc',
      name: 'Dropper',
      color: '#e74c3c',
      x: 300,
      y: 400,
      angle: 0,
      speed: 100,
      steerVisual: 0,
      isBraking: false,
      score: 42,
      timestamp: Date.now(),
    });

    // Mark as disconnected
    manager.markDisconnected('p_dc');

    const player = manager.players.get('p_dc');
    expect(player).toBeDefined();
    expect(player?.isDisconnected).toBe(true);
    // Score must be frozen at 42!
    expect(player?.score).toBe(42);
    // Speed should be halted
    expect(player?.speed).toBe(0);

    // Collisions should be ignored while disconnected
    const hit = manager.checkCollisionWithPlayer(305, 405, 24);
    expect(hit).toBeNull();

    // Drawing minimap and 3D pill with disconnected state
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    expect(() => manager.drawMinimap(ctx, 0, 0, 0.1, 0.1)).not.toThrow();
  });

  it('restores disconnected player when they reconnect, preserving previous frozen score', () => {
    const manager = new RemotePlayerManager();
    manager.updateFromNetwork({
      id: 'p_old_id',
      name: 'ReturningPilot',
      color: '#00e5ff',
      x: 100,
      y: 100,
      angle: 0,
      speed: 80,
      steerVisual: 0,
      isBraking: false,
      score: 65,
      timestamp: Date.now(),
    });

    manager.markDisconnected('p_old_id');
    expect(manager.players.get('p_old_id')?.isDisconnected).toBe(true);

    // Reconnection under new peer ID with same name
    manager.updateFromNetwork({
      id: 'p_new_id',
      name: 'ReturningPilot',
      color: '#00e5ff',
      x: 200,
      y: 200,
      angle: 0,
      speed: 90,
      steerVisual: 0,
      isBraking: false,
      score: 70, // Reconnected and increased score
      timestamp: Date.now(),
    });

    // Old id should be re-associated to new id
    expect(manager.players.has('p_old_id')).toBe(false);
    const restored = manager.players.get('p_new_id');
    expect(restored).toBeDefined();
    expect(restored?.isDisconnected).toBe(false);
    expect(restored?.score).toBe(70);
  });

  it('marks player as disconnected on timeout (> 5000ms) without deleting their score', () => {
    const manager = new RemotePlayerManager();
    manager.updateFromNetwork({
      id: 'p_timeout',
      name: 'Laggy',
      color: '#ffbe0b',
      x: 100,
      y: 100,
      angle: 0,
      speed: 50,
      steerVisual: 0,
      isBraking: false,
      score: 88,
      timestamp: Date.now(),
    });

    // Force lastUpdate to 6 seconds in the past
    const player = manager.players.get('p_timeout')!;
    player.lastUpdate = Date.now() - 6000;

    manager.update(0.1);

    // Player should STILL exist with score 88, marked disconnected
    expect(manager.players.has('p_timeout')).toBe(true);
    expect(player.isDisconnected).toBe(true);
    expect(player.score).toBe(88);
    expect(player.speed).toBe(0);
  });

  it('updates remote player palette when network color changes', () => {
    const manager = new RemotePlayerManager();
    manager.updateFromNetwork({
      id: 'p_color',
      name: 'Chameleon',
      color: '#e74c3c',
      x: 100,
      y: 100,
      angle: 0,
      speed: 80,
      steerVisual: 0,
      isBraking: false,
      score: 10,
      timestamp: Date.now(),
    });

    const player = manager.players.get('p_color')!;
    expect(player.entity.palette.body).toBe('#e74c3c');

    manager.updateFromNetwork({
      id: 'p_color',
      name: 'Chameleon',
      color: '#00e5ff',
      x: 120,
      y: 100,
      angle: 0,
      speed: 80,
      steerVisual: 0,
      isBraking: false,
      score: 15,
      timestamp: Date.now(),
    });

    expect(player.color).toBe('#00e5ff');
    expect(player.entity.palette.body).toBe('#00e5ff');
  });
});
