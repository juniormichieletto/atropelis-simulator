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
    service.spawnSeed = 42;
    service.peerOrder = ['p_1', 'p_2'];

    service.leave();
    expect(service.roomId).toBe('');
    expect(service.isConnected).toBe(false);
    expect(service.spawnSeed).toBe(0);
    expect(service.peerOrder).toEqual([]);
    expect(service.getConnectedPeers().length).toBe(1);
  });

  it('manages spawn seeds and player spawn indices correctly', async () => {
    const service = new MultiplayerService('SlotTester');
    await service.join('ALPHA99', true);

    // Initial fallback seed generated from roomId
    const fallbackSeed = service.getSpawnSeed();
    expect(fallbackSeed).toBeGreaterThan(0);

    // Initial index when solo
    expect(service.getMySpawnIndex()).toBe(0);

    // Host starts game: sets seed and peer order
    service.startGame();
    expect(service.spawnSeed).toBeGreaterThan(0);
    expect(service.peerOrder).toContain(service.myId);

    // Peer order index when peer is present
    service.peerOrder = ['other_peer', service.myId];
    expect(service.getMySpawnIndex()).toBe(1);
  });

  it('sends NPC hit events and notifies callback when npc_hit is received', async () => {
    const service = new MultiplayerService('Hitter');
    const onNpcHitMock = vi.fn();
    service.setCallbacks({ onNpcHit: onNpcHitMock });

    await service.join('ROOM123', false);

    expect(() => {
      service.sendNpcHit(42, 500, 600, 1.57, 130);
    }).not.toThrow();

    service.leave();
  });
});
