import { describe, it, expect, vi } from 'vitest';
import { Entity, EntityManager, ENTITY_SCALE } from '../Entities';
import { PlayerCar } from '../PlayerCar';
import { TileMap } from '../TileMap';

describe('Entity & EntityManager', () => {
  it('initializes entities with correct point values and speeds', () => {
    const person = new Entity(100, 100, 'PERSON');
    const bike = new Entity(100, 100, 'BIKE');
    const moto = new Entity(100, 100, 'MOTORCYCLE');
    const car = new Entity(100, 100, 'CAR');

    expect(person.points).toBe(1);
    expect(bike.points).toBe(2);
    expect(moto.points).toBe(5);
    expect(car.points).toBe(-5);
    expect(Math.abs(Math.sin(bike.angle * 2))).toBeLessThan(1e-6);
    expect(Math.abs(Math.sin(moto.angle * 2))).toBeLessThan(1e-6);
    expect(Math.abs(Math.sin(car.angle * 2))).toBeLessThan(1e-6);
  });

  it('updates entity position, despawns out of bounds, and turns on building collision', () => {
    const map = new TileMap();
    const person = new Entity(550, 850, 'PERSON');
    person.angle = 0;
    person.update(0.2, map);
    expect(person.x).toBeGreaterThan(550);
    expect(person.isAlive).toBe(true);

    // Move into building at row 3, col 5 (x: 500..600, y: 300..400)
    const colliderEntity = new Entity(480, 350, 'CAR');
    colliderEntity.speed = 300;
    colliderEntity.angle = 0;
    const prevAngle = colliderEntity.angle;
    colliderEntity.update(0.1, map);
    expect(colliderEntity.angle).not.toBe(prevAngle);

    // Out of bounds despawn
    const outEntity = new Entity(-50, 100, 'BIKE');
    outEntity.update(0.1, map);
    expect(outEntity.isAlive).toBe(false);
  });

  it('launches hit entities into a 3D accident arc, bounces on ground, and removes them after flight', () => {
    const person = new Entity(500, 850, 'PERSON');
    person.triggerHit(480, 850, 0, 320);

    expect(person.isHit).toBe(true);
    expect(person.vz).toBeGreaterThan(0);

    // Step mid-air flight
    person.update(0.15);
    expect(person.z).toBeGreaterThan(0);
    expect(person.spinAngle).not.toBe(0);
    expect(person.isAlive).toBe(true);

    // Render while airborne
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    person.draw3D(ctx, 640, 420, 8, 0.2);

    // Advance past maxHitDuration -> bounces and then despawns
    person.update(0.45);
    person.update(0.5);
    expect(person.isAlive).toBe(false);
  });

  it('renders 3D rear, oncoming, 3/4 diagonal, and side profile sprites for all entity types', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    const scaleSpy = vi.spyOn(ctx, 'scale');
    const arcSpy = vi.spyOn(ctx, 'arc');

    const angles = [
      0.1, // rear view
      Math.PI, // oncoming front view
      Math.PI / 4, // 3/4 rear diagonal right
      (3 * Math.PI) / 4, // 3/4 front diagonal right
      Math.PI / 2, // pure side profile right
      -Math.PI / 2, // pure side profile left
    ];

    const types = ['PERSON', 'BIKE', 'MOTORCYCLE', 'CAR'] as const;
    for (const type of types) {
      const e = new Entity(100, 100, type);
      for (const relAngle of angles) {
        e.draw3D(ctx, 640, 400, 2.5, relAngle);
      }
    }

    expect(fillRectSpy).toHaveBeenCalled();
    expect(scaleSpy).toHaveBeenCalled();
    expect(arcSpy).toHaveBeenCalled();
  });

  it('spawns, updates, and projects visible entities in EntityManager', () => {
    const map = new TileMap();
    const manager = new EntityManager();
    manager.update(0.1, 450, 850, map, 0);

    expect(manager.entities.length).toBeGreaterThan(0);

    // Place an entity directly in front of the camera at (550, 850)
    manager.entities.push(new Entity(550, 850, 'MOTORCYCLE'));
    const drawables = manager.getVisibleEntityDrawables(450, 850, 0, 52, 270, 832, 1280);
    expect(drawables.length).toBeGreaterThan(0);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    drawables[0].draw(ctx);
  });

  it('maintains realistic physical scale proportions between rival vehicles, pedestrians, and player car', () => {
    expect(ENTITY_SCALE).toBeGreaterThanOrEqual(1.8);

    const player = new PlayerCar(450, 850);
    const rivalCar = new Entity(450, 850, 'CAR');
    const person = new Entity(450, 850, 'PERSON');
    const moto = new Entity(450, 850, 'MOTORCYCLE');
    const bike = new Entity(450, 850, 'BIKE');

    // 1. Desktop Viewport (1280x720)
    const desktopPlayerDims = player.getVisualDimensions(1280, 720);
    // Camera projection scale at player contact line (tz = 82)
    const desktopFocalLength = Math.max(320, (((720 - 92) - Math.floor(720 * 0.38)) * 82) / 52);
    const desktopProjScale = desktopFocalLength / 82;

    const desktopRivalDims = rivalCar.getVisualDimensions(desktopProjScale, 0);
    const desktopPersonDims = person.getVisualDimensions(desktopProjScale, 0);
    const desktopMotoDims = moto.getVisualDimensions(desktopProjScale, Math.PI / 2); // side profile
    const desktopBikeDims = bike.getVisualDimensions(desktopProjScale, Math.PI / 2);

    // Rival car width must match player car width within ±15% (never miniature or half size)
    const carWidthRatio = desktopRivalDims.width / desktopPlayerDims.width;
    expect(carWidthRatio).toBeGreaterThanOrEqual(0.85);
    expect(carWidthRatio).toBeLessThanOrEqual(1.20);

    // Standing person height must be taller than sports car body height
    expect(desktopPersonDims.height).toBeGreaterThan(desktopPlayerDims.height * 1.05);

    // Motorcycle length in profile must be substantial (at least 60% of player car width)
    expect(desktopMotoDims.width).toBeGreaterThan(desktopPlayerDims.width * 0.6);

    // Bike length in profile must be substantial (at least 50% of player car width)
    expect(desktopBikeDims.width).toBeGreaterThan(desktopPlayerDims.width * 0.5);

    // 2. Mobile Landscape Viewport (844x390)
    const mobilePlayerDims = player.getVisualDimensions(844, 390);
    const mobileContactY = 390 - 64;
    const mobileHorizonY = Math.floor(390 * 0.35);
    const mobileFocalLength = Math.max(420, ((mobileContactY - mobileHorizonY) * 82) / 52);
    const mobileProjScale = mobileFocalLength / 82;

    const mobileRivalDims = rivalCar.getVisualDimensions(mobileProjScale, 0);
    const mobilePersonDims = person.getVisualDimensions(mobileProjScale, 0);

    // In mobile landscape mode, rival car must still match player car width within ±15%
    const mobileCarRatio = mobileRivalDims.width / mobilePlayerDims.width;
    expect(mobileCarRatio).toBeGreaterThanOrEqual(0.85);
    expect(mobileCarRatio).toBeLessThanOrEqual(1.20);

    // Pedestrian must still be proportional to the car on mobile landscape
    expect(mobilePersonDims.height).toBeGreaterThan(mobilePlayerDims.height * 0.95);
  });

  it('multiplayer mode disables respawn: obstacle count strictly decreases after collisions', () => {
    const manager = new EntityManager();
    const map = new TileMap();

    // Initialize multiplayer with 10 finite obstacles
    manager.initMultiplayer(10, map);
    expect(manager.allowRespawn).toBe(false);
    expect(manager.entities.length).toBe(10);

    const initialCount = manager.entities.length;

    // Normal movement update: count stays at 10 (no distance despawn, no new spawns)
    manager.update(0.1, 450, 850, map, 0);
    expect(manager.entities.length).toBe(initialCount);

    // Hit the first entity
    const victim1 = manager.entities[0];
    victim1.triggerHit(450, 850, 0, 150);
    expect(victim1.isHit).toBe(true);

    // While in flight, the entity is still alive and visible
    manager.update(0.2, 450, 850, map, 0);
    expect(victim1.isAlive).toBe(true);
    expect(manager.entities.length).toBe(initialCount);

    // Advance time past maxHitDuration (0.95s) so the accident completes
    manager.update(1.0, 450, 850, map, 0);
    expect(victim1.isAlive).toBe(false);

    // Update again: victim1 is removed and NO replacement is spawned!
    manager.update(0.1, 450, 850, map, 0);
    expect(manager.entities.length).toBe(initialCount - 1);

    // Hit another entity
    const victim2 = manager.entities[0];
    victim2.triggerHit(450, 850, 0, 150);
    // Advance past maxHitDuration
    manager.update(1.0, 450, 850, map, 0);
    manager.update(0.1, 450, 850, map, 0);

    // Count must have decreased again: exactly 8 remaining
    expect(manager.entities.length).toBe(initialCount - 2);

    // In solo mode with allowRespawn = true, respawn must replenish entities
    manager.allowRespawn = true;
    manager.maxEntities = 15;
    manager.update(0.1, 450, 850, map, 0);
    expect(manager.entities.length).toBe(15);
  });
});
