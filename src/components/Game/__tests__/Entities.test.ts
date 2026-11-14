import { describe, it, expect, vi } from 'vitest';
import { Entity, EntityManager } from '../Entities';
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
});
