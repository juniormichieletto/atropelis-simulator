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
      ping: vi.fn().mockResolvedValue(45),
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

  it('measures ping latency across connected peers', async () => {
    const service = new MultiplayerService('Pinger');
    // Not connected yet
    const nullPing = await service.getPing();
    expect(nullPing).toBeNull();

    await service.join('PING_ROOM', false);
    // No remote peers yet
    expect(await service.getPing()).toBeNull();

    // Simulate remote peer info
    const info = { id: 'peer_1', name: 'Other', color: '#ff0000', isHost: true, isReady: true };
    // Trigger onPeersUpdated by mocking peer map
    (service as unknown as { peers: Map<string, typeof info> }).peers.set('peer_1', info);

    const ping = await service.getPing();
    expect(ping).toBe(45);

    const targetPing = await service.getPing('peer_1');
    expect(targetPing).toBe(45);
  });

  it('automatically picks a different unique color when peers join or when game starts', async () => {
    const service = new MultiplayerService('RacerA');
    await service.join('COLOR_ROOM', true);

    // Initial default color is first palette color
    expect(service.myColor).toBe(MULTIPLAYER_CAR_COLORS[0].main);

    // Simulate another peer joining with the same color
    const peer1 = { id: 'peer_1', name: 'RacerB', color: MULTIPLAYER_CAR_COLORS[0].main, isHost: false, isReady: true };
    (service as unknown as { peers: Map<string, typeof peer1> }).peers.set('peer_1', peer1);

    // Automatic pick selects the next available color
    const newColor = service.pickUniqueColor();
    expect(newColor).toBe(MULTIPLAYER_CAR_COLORS[1].main);
    expect(service.myColor).toBe(MULTIPLAYER_CAR_COLORS[1].main);

    // Host starts game: automatically assigns unique colors to all peers
    service.startGame();
    expect(service.raceStartTime).toBeGreaterThan(0);
    expect(service.colorAssignments[service.myId]).toBe(MULTIPLAYER_CAR_COLORS[1].main);
    expect(service.colorAssignments['peer_1']).toBe(MULTIPLAYER_CAR_COLORS[0].main);
    expect(service.colorAssignments[service.myId]).not.toBe(service.colorAssignments['peer_1']);

    service.leave();
    expect(service.raceStartTime).toBe(0);
  });

  it('preserves distinct manually chosen lobby colors on startGame and resolves duplicate conflicts', async () => {
    const service = new MultiplayerService('Host');
    await service.join('CUSTOM_COLOR', true);

    const chosenHostColor = MULTIPLAYER_CAR_COLORS[3].main;
    const chosenPeerColor = MULTIPLAYER_CAR_COLORS[4].main;
    service.setCarColor(chosenHostColor, true);

    const peersMap = (service as unknown as {
      peers: Map<string, { id: string; name: string; color: string; isHost: boolean; isReady: boolean }>;
    }).peers;
    peersMap.set('peer_a', { id: 'peer_a', name: 'A', color: chosenPeerColor, isHost: false, isReady: true });
    peersMap.set('peer_b', { id: 'peer_b', name: 'B', color: chosenPeerColor, isHost: false, isReady: true });

    service.startGame();

    // Host and peer_a keep their distinct chosen colors; peer_b is reassigned to an unused color
    expect(service.colorAssignments[service.myId]).toBe(chosenHostColor);
    expect(service.colorAssignments['peer_a']).toBe(chosenPeerColor);
    expect(service.colorAssignments['peer_b']).toBeDefined();
    expect(service.colorAssignments['peer_b']).not.toBe(chosenPeerColor);
    expect(service.colorAssignments['peer_b']).not.toBe(chosenHostColor);

    service.leave();
  });
});
