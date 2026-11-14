import { describe, it, expect, vi } from 'vitest';
import { MultiplayerService, MULTIPLAYER_CAR_COLORS } from '../MultiplayerService';

vi.mock('trystero', () => {
  return {
    joinRoom: vi.fn(() => ({
      makeAction: vi.fn(() => ({
        send: vi.fn().mockResolvedValue(undefined),
        onMessage: vi.fn(),
        onReceiveProgress: vi.fn(),
        onReceive: vi.fn(),
      })),
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      leave: vi.fn(),
    })),
  };
});

describe('MultiplayerService', () => {
  it('initializes with default player name, random id, and primary color', () => {
    const service = new MultiplayerService('TestPlayer');
    expect(service.myName).toBe('TestPlayer');
    expect(service.myId).toMatch(/^p_/);
    expect(service.myColor).toBe(MULTIPLAYER_CAR_COLORS[0].main);
    expect(service.isConnected).toBe(false);
  });

  it('updates car color and lists connected peers including local player', () => {
    const service = new MultiplayerService('Racer1');
    service.setCarColor('#00e5ff');
    expect(service.myColor).toBe('#00e5ff');

    const peers = service.getConnectedPeers();
    expect(peers.length).toBe(1);
    expect(peers[0].name).toBe('Racer1');
    expect(peers[0].color).toBe('#00e5ff');
  });

  it('joins room, broadcasts info, and sends updates when connected', async () => {
    const service = new MultiplayerService('HostRacer');
    const ok = await service.join('ROOM42', true);
    expect(ok).toBe(true);
    expect(service.roomId).toBe('ROOM42');
    expect(service.isHost).toBe(true);
    expect(service.isConnected).toBe(true);

    expect(() => {
      service.sendPlayerUpdate({
        x: 100,
        y: 200,
        angle: 0,
        speed: 50,
        steerVisual: 0,
        isBraking: false,
        score: 10,
      });
      service.sendNpcUpdate([]);
      service.sendHit('p_target');
      service.startGame();
    }).not.toThrow();

    service.leave();
    expect(service.isConnected).toBe(false);
    expect(service.roomId).toBe('');
  });

  it('leaves room cleanly and resets state', () => {
    const service = new MultiplayerService('Racer2');
    service.roomId = 'ROOM99';
    service.isConnected = true;

    service.leave();
    expect(service.roomId).toBe('');
    expect(service.isConnected).toBe(false);
    expect(service.getConnectedPeers().length).toBe(1);
  });
});
