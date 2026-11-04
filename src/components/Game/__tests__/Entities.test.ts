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
  });

  it('updates entity position, despawns out of bounds, and turns on building collision', () => {
    const map = new TileMap();
    const person = new Entity(550, 850, 'PERSON');
    person.angle = 0;
    person.update(0.2, map);
    expect(person.x).toBeGreaterThan(550);
    expect(person.isAlive).toBe(true);

    // Move into building at (550, 350)
    const colliderEntity = new Entity(548, 350, 'CAR');
    colliderEntity.angle = 0;
    const prevAngle = colliderEntity.angle;
    colliderEntity.update(0.1, map);
    expect(colliderEntity.angle).not.toBe(prevAngle);

    // Out of bounds despawn
    const outEntity = new Entity(-50, 100, 'BIKE');
    outEntity.update(0.1, map);
    expect(outEntity.isAlive).toBe(false);
  });

  it('renders 3D perspective sprites for all entity types', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');

    const types = ['PERSON', 'BIKE', 'MOTORCYCLE', 'CAR'] as const;
    for (const type of types) {
      const e = new Entity(100, 100, type);
      e.draw3D(ctx, 640, 400, 2.5, 0.3);
      e.draw3D(ctx, 640, 400, 2.5, Math.PI); // oncoming orientation
    }

    expect(fillRectSpy).toHaveBeenCalled();
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
