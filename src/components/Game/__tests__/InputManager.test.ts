import { describe, it, expect } from 'vitest';
import { InputManager } from '../InputManager';

describe('InputManager', () => {
  it('tracks keyboard WASD and Arrow key states accurately', () => {
    const input = new InputManager();

    expect(input.getMovementInput()).toEqual({
      forward: false,
      backward: false,
      left: false,
      right: false,
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));

    expect(input.getMovementInput()).toEqual({
      forward: true,
      backward: false,
      left: true,
      right: false,
    });

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd' }));

    expect(input.getMovementInput()).toEqual({
      forward: false,
      backward: true,
      left: true,
      right: true,
    });

    input.destroy();
  });

  it('merges manualInput with keyboard state', () => {
    const input = new InputManager();
    input.setManualInput({ forward: true, backward: false, left: false, right: true });

    expect(input.getMovementInput()).toEqual({
      forward: true,
      backward: false,
      left: false,
      right: true,
    });

    input.destroy();
  });
});
