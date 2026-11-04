import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Provide a complete Canvas 2D Context mock for jsdom unit tests
class MockCanvasRenderingContext2D {
  fillStyle: string | CanvasGradient = '#000';
  strokeStyle: string = '#000';
  lineWidth: number = 1;
  font: string = '10px sans-serif';
  textAlign: string = 'start';
  imageSmoothingEnabled: boolean = true;

  clearRect = vi.fn();
  fillRect = vi.fn();
  strokeRect = vi.fn();
  beginPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  arc = vi.fn();
  ellipse = vi.fn();
  fill = vi.fn();
  stroke = vi.fn();
  fillText = vi.fn();
  save = vi.fn();
  restore = vi.fn();
  translate = vi.fn();
  rotate = vi.fn();
  scale = vi.fn();
  drawImage = vi.fn();
  createLinearGradient = vi.fn(() => ({
    addColorStop: vi.fn(),
  }));
  createImageData = vi.fn((w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  }));
  getImageData = vi.fn((_x: number, _y: number, w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  }));
  putImageData = vi.fn();
}

HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement, contextId: string) {
  if (contextId === '2d') {
    return new MockCanvasRenderingContext2D() as unknown as CanvasRenderingContext2D;
  }
  return null;
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Mock Web Audio API for jsdom
class MockAudioParam {
  value = 0;
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
}

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam();
  start = vi.fn();
  stop = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowpass';
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: AudioBuffer | null = null;
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  resume = vi.fn();
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createGain = vi.fn(() => new MockGainNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
  createBuffer = vi.fn((_channels: number, length: number, sampleRate: number) => ({
    length,
    sampleRate,
    getChannelData: () => new Float32Array(length),
  }));
}

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: MockAudioContext,
});
