export class InputManager {
  keys: { [key: string]: boolean } = {};
  manualInput = { forward: false, backward: false, left: false, right: false };
  
  private keydownHandler: (e: KeyboardEvent) => void;
  private keyupHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.keydownHandler = (e: KeyboardEvent) => {
      this.keys[e.code] = true;
      this.keys[e.key] = true;
    };
    this.keyupHandler = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
      this.keys[e.key] = false;
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }

  setManualInput(input: typeof this.manualInput) {
    this.manualInput = input;
  }

  getMovementInput() {
    return {
      forward: this.keys['ArrowUp'] || this.keys['KeyW'] || this.keys['w'] || this.manualInput.forward,
      backward: this.keys['ArrowDown'] || this.keys['KeyS'] || this.keys['s'] || this.manualInput.backward,
      left: this.keys['ArrowLeft'] || this.keys['KeyA'] || this.keys['a'] || this.manualInput.left,
      right: this.keys['ArrowRight'] || this.keys['KeyD'] || this.keys['d'] || this.manualInput.right,
    };
  }

  destroy() {
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
  }
}
