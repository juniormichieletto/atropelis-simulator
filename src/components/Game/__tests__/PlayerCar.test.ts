import { describe, it, expect, vi } from 'vitest';
import { PlayerCar } from '../PlayerCar';

describe('PlayerCar', () => {
  it('auto-accelerates forward by default when not braking', () => {
    const car = new PlayerCar(100, 100);
    car.update(0.5, { forward: false, backward: false, left: false, right: false, autoAccelerate: true });

    expect(car.speed).toBeGreaterThan(0);
    expect(car.x).toBeGreaterThan(100);
    expect(car.isBraking).toBe(false);
  });

  it('boosts above normal maxSpeed when forward (W/Up) is held explicitly', () => {
    const car = new PlayerCar(0, 0);
    car.speed = car.maxSpeed;
    car.update(0.5, { forward: true, backward: false, left: false, right: false, autoAccelerate: true });

    expect(car.speed).toBeGreaterThan(car.maxSpeed);
    expect(car.speed).toBeLessThanOrEqual(car.maxSpeed * 1.1);
  });

  it('brakes and reverses when backward (S/Down) is held', () => {
    const car = new PlayerCar(100, 100);
    car.speed = 100;
    car.update(1.0, { forward: false, backward: true, left: false, right: false, autoAccelerate: true });

    expect(car.isBraking).toBe(true);
    expect(car.speed).toBeLessThan(0);
  });

  it('applies passive friction when autoAccelerate is disabled and no throttle input is active', () => {
    const car = new PlayerCar(100, 100);
    car.speed = 50;
    car.update(0.5, { forward: false, backward: false, left: false, right: false, autoAccelerate: false });

    expect(car.speed).toBeLessThan(50);
    expect(car.speed).toBeGreaterThan(0);
  });

  it('steers left and right via keyboard and updates steerVisual smoothly', () => {
    const car = new PlayerCar(100, 100);
    car.speed = 150;

    car.update(0.2, { forward: true, backward: false, left: false, right: true });
    expect(car.angle).toBeGreaterThan(0);
    expect(car.steerVisual).toBeGreaterThan(0);

    const prevAngle = car.angle;
    car.update(0.4, { forward: true, backward: false, left: true, right: false });
    expect(car.angle).toBeLessThan(prevAngle);
  });

  it('computes touch/mouse steering from screen X coordinate with center deadzone', () => {
    const car = new PlayerCar(100, 100);
    const screenW = 1000;

    // Center deadzone -> drives straight (pointerSteer = 0)
    car.setPointerScreenX(500, screenW);
    expect(car.pointerSteer).toBe(0);

    // Left side -> negative steer
    car.setPointerScreenX(100, screenW);
    expect(car.pointerSteer).toBeLessThan(0);

    // Right side -> positive steer
    car.setPointerScreenX(900, screenW);
    expect(car.pointerSteer).toBeGreaterThan(0);

    car.clearTarget();
    expect(car.pointerSteer).toBeNull();
  });

  it('renders rear-view Top Gear 3000 supercar including nitro flames and brake lights', () => {
    const car = new PlayerCar(100, 100);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');

    // High-speed nitro flame state
    car.speed = 260;
    car.steerVisual = 0.5;
    car.isBraking = false;
    car.drawRearView(ctx, 1280, 720);
    expect(fillRectSpy).toHaveBeenCalled();

    // Braking state
    fillRectSpy.mockClear();
    car.isBraking = true;
    car.steerVisual = -0.5;
    car.drawRearView(ctx, 1280, 720);
    expect(fillRectSpy).toHaveBeenCalled();
  });
});
