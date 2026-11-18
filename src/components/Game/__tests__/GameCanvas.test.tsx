import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GameCanvas } from '../GameCanvas';
import { getPlayerSpawnPoint } from '../SpawnPoints';
import { soundService } from '../../../services/SoundService';
import { LocalStorageService } from '../../../services/LocalStorageService';
import type { MultiplayerService, MultiplayerEventCallback } from '../../../services/MultiplayerService';

describe('GameCanvas Multiplayer Mode', () => {
  let mockMpService: Partial<MultiplayerService>;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    mockMpService = {
      roomId: 'RACE99',
      myId: 'local-pilot-id',
      myName: 'SPEED_DEVIL',
      myColor: '#ff2a85',
      isHost: true,
      getConnectedPeers: vi.fn(() => []),
      setCallbacks: vi.fn(),
      sendPlayerUpdate: vi.fn(),
      sendNpcUpdate: vi.fn(),
      sendHit: vi.fn(),
      sendNpcHit: vi.fn(),
      broadcastHit: vi.fn(),
      leave: vi.fn(),
      getPing: vi.fn().mockResolvedValue(42),
      getMyColor: vi.fn(() => '#ff2a85'),
      getMySpawnIndex: vi.fn(() => 0),
      getSpawnSeed: vi.fn(() => 12345),
    };
  });

  afterEach(() => {
    soundService.setMuted(false);
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders multiplayer HUD elements and live score board', () => {
    render(
      <GameCanvas
        multiplayerService={mockMpService as MultiplayerService}
        onGameOver={vi.fn()}
      />
    );

    expect(screen.getByText('ONLINE P2P')).toBeInTheDocument();
    expect(screen.getByText(/SALA: RACE99/i)).toBeInTheDocument();
    expect(screen.getByText('PLACAR AO VIVO')).toBeInTheDocument();
    expect(screen.getByText(/SPEED_DEVIL \(VOCÊ\)/i)).toBeInTheDocument();
    expect(screen.getByText(/RANK #1/i)).toBeInTheDocument();
    expect(screen.getByText('SAIR')).toBeInTheDocument();
    expect(screen.getByText(/📶/)).toBeInTheDocument();
  });

  it('NEVER pauses on blur or visibilitychange when in multiplayer mode', () => {
    const pauseMusicSpy = vi.spyOn(soundService, 'pauseBackgroundMusic');

    render(
      <GameCanvas
        multiplayerService={mockMpService as MultiplayerService}
        onGameOver={vi.fn()}
      />
    );

    // Simulate tab blur / hidden
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => {
      window.dispatchEvent(new Event('blur'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // In multiplayer mode, pauseBackgroundMusic should NEVER be called!
    expect(pauseMusicSpy).not.toHaveBeenCalled();

    delete (document as unknown as { hidden?: boolean }).hidden;
  });

  it('saves multiplayer score on timer expiration and displays final results overlay', () => {
    const onGameOverMock = vi.fn();
    const onBackToMenuMock = vi.fn();

    render(
      <GameCanvas
        multiplayerService={mockMpService as MultiplayerService}
        onGameOver={onGameOverMock}
        onBackToMenu={onBackToMenuMock}
      />
    );

    // Advance time by 61 seconds so wall-clock timer reaches 0
    act(() => {
      vi.advanceTimersByTime(61000);
    });

    // Check that multiplayer results modal appeared
    expect(screen.getByText('FIM DA CORRIDA!')).toBeInTheDocument();
    expect(screen.getByText(/🏆 1º LUGAR! CAMPEÃO!/i)).toBeInTheDocument();
    expect(screen.getByText(/PLACAR MULTIPLAYER • SALA RACE99/i)).toBeInTheDocument();

    // Verify multiplayer score was saved to multiplayer storage
    const mpScores = LocalStorageService.getMultiplayerScores();
    expect(mpScores.length).toBe(1);
    expect(mpScores[0].rank).toBe(1);

    // Solo scores must remain empty!
    expect(LocalStorageService.getScores().length).toBe(0);

    // Click "VOLTAR AO MENU"
    fireEvent.click(screen.getByText('VOLTAR AO MENU'));
    expect(mockMpService.leave).toHaveBeenCalledTimes(1);
    expect(onBackToMenuMock).toHaveBeenCalledTimes(1);
  });

  it('stops background music, freezes game loop, and ignores input/hits when match time expires', () => {
    const stopMusicSpy = vi.spyOn(soundService, 'stopBackgroundMusic');
    const resumeMusicSpy = vi.spyOn(soundService, 'resumeBackgroundMusic');
    const playHitSpy = vi.spyOn(soundService, 'playHitSound');

    let registeredCallbacks: MultiplayerEventCallback | null = null;
    mockMpService.setCallbacks = vi.fn((cbs) => {
      registeredCallbacks = cbs;
    });

    render(
      <GameCanvas
        multiplayerService={mockMpService as MultiplayerService}
        onGameOver={vi.fn()}
      />
    );

    // End match
    act(() => {
      vi.advanceTimersByTime(61000);
    });

    // 1. Music must be completely stopped
    expect(stopMusicSpy).toHaveBeenCalled();

    // 2. Clicking, typing, or touching during results screen must NOT resume music or game loop
    fireEvent.click(window);
    fireEvent.keyDown(window, { key: 'w', code: 'KeyW' });
    fireEvent.touchStart(window, { touches: [{ clientX: 200, clientY: 200 }] });
    expect(resumeMusicSpy).not.toHaveBeenCalled();

    // 3. Incoming remote player hit events after race ended must NOT play crash sound
    if (registeredCallbacks?.onPlayerHit) {
      registeredCallbacks.onPlayerHit('remote-peer-id');
    }
    expect(playHitSpy).not.toHaveBeenCalled();
  });

  it('keeps disconnected player score frozen until game end and preserves their standing', () => {
    let registeredCallbacks: MultiplayerEventCallback | null = null;
    mockMpService.setCallbacks = vi.fn((cbs) => {
      registeredCallbacks = cbs;
    });

    render(
      <GameCanvas
        multiplayerService={mockMpService as MultiplayerService}
        onGameOver={vi.fn()}
      />
    );

    // 1. Remote player joins and scores 75 points
    act(() => {
      registeredCallbacks?.onRemotePlayerUpdate?.({
        id: 'peer_rival',
        name: 'RivalChampion',
        color: '#00e5ff',
        x: 500,
        y: 600,
        angle: 0,
        speed: 150,
        steerVisual: 0,
        isBraking: false,
        score: 75,
        timestamp: Date.now(),
      });
    });

    expect(screen.getByText(/RivalChampion/i)).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();

    // 2. Remote player disconnects
    act(() => {
      registeredCallbacks?.onPeerLeave?.('peer_rival');
    });

    // Score remains frozen at 75 on live leaderboard with [OFF] status
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText(/RivalChampion \[OFF\]/i)).toBeInTheDocument();

    // 3. Race ends
    act(() => {
      vi.advanceTimersByTime(61000);
    });

    // 4. Disconnected player must be present in the final standings with 75 points
    expect(screen.getByText(/FIM DA CORRIDA!/i)).toBeInTheDocument();
    expect(screen.getByText(/RivalChampion \(DESCONECTADO\)/i)).toBeInTheDocument();
    expect(screen.getByText('75 PTS')).toBeInTheDocument();

    // Local player had 0 points, so local player rank is #2 out of 2 racers
    expect(screen.getByText(/2º LUGAR/i)).toBeInTheDocument();

    const mpScores = LocalStorageService.getMultiplayerScores();
    expect(mpScores[0].rank).toBe(2);
    expect(mpScores[0].playersCount).toBe(2);
  });

  it('renders orientation button and handles horizontal mode toggle and rotate prompt', async () => {
    // Simulate portrait orientation: height > width
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 360 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 740 });

    const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreenMock;

    const lockMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.screen, 'orientation', {
      value: {
        lock: lockMock,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
      writable: true,
    });

    render(<GameCanvas onGameOver={vi.fn()} />);

    const orientationBtn = screen.getByTitle(/Alternar Orientação Horizontal/i);
    expect(orientationBtn).toBeInTheDocument();

    // Clicking orientation button in portrait shows the rotate prompt overlay
    await act(async () => {
      fireEvent.click(orientationBtn);
    });

    expect(requestFullscreenMock).toHaveBeenCalled();
    expect(screen.getByText('MODO HORIZONTAL')).toBeInTheDocument();
    expect(screen.getByText(/Gire o seu celular para a posição horizontal/i)).toBeInTheDocument();

    // Dismiss with ENTENDI button
    fireEvent.click(screen.getByRole('button', { name: /ENTENDI/i }));
    expect(screen.queryByText('MODO HORIZONTAL')).not.toBeInTheDocument();

    // Open again
    await act(async () => {
      fireEvent.click(orientationBtn);
    });
    expect(screen.getByText('MODO HORIZONTAL')).toBeInTheDocument();

    // Now simulate user rotating phone into landscape: width > height
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 740 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 360 });

    act(() => {
      fireEvent(window, new Event('orientationchange'));
      vi.advanceTimersByTime(350);
    });

    // Rotate prompt is automatically dismissed
    expect(screen.queryByText('MODO HORIZONTAL')).not.toBeInTheDocument();
  });

  it('handles remote NPC sync and processes onNpcHit events', () => {
    let registeredCallbacks: MultiplayerEventCallback | null = null;
    mockMpService.isHost = false; // Guest client
    mockMpService.setCallbacks = vi.fn((callbacks) => {
      registeredCallbacks = callbacks;
    });

    render(
      <GameCanvas
        multiplayerService={mockMpService as MultiplayerService}
        onGameOver={vi.fn()}
      />
    );

    expect(registeredCallbacks).not.toBeNull();

    // Host sends 2 NPCs to the guest
    act(() => {
      registeredCallbacks?.onNpcUpdate?.([
        {
          id: 101,
          type: 'CAR',
          x: 500,
          y: 850,
          z: 0,
          angle: 0,
          speed: 80,
          isHit: false,
          color: '#e74c3c',
        },
        {
          id: 102,
          type: 'PERSON',
          x: 520,
          y: 860,
          z: 0,
          angle: 0,
          speed: 35,
          isHit: false,
          color: '#FF9F43',
        },
      ]);
    });

    // Remote hit arrives for NPC 101
    const playHitSpy = vi.spyOn(soundService, 'playHitSound');
    act(() => {
      registeredCallbacks?.onNpcHit?.(101, 'other-player-id', {
        x: 500,
        y: 850,
        angle: 0,
        speed: 100,
      });
    });

    expect(playHitSpy).toHaveBeenCalledWith('CAR');

    // Host updates list with only 1 NPC remaining (101 was destroyed)
    act(() => {
      registeredCallbacks?.onNpcUpdate?.([
        {
          id: 102,
          type: 'PERSON',
          x: 525,
          y: 860,
          z: 0,
          angle: 0,
          speed: 35,
          isHit: false,
          color: '#FF9F43',
        },
      ]);
    });
  });

  it('awards +20 points and triggers sound/shake when colliding with another player in multiplayer', () => {
    let animationCallback: ((time: number) => void) | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      animationCallback = cb;
      return 1;
    });

    let registeredCallbacks: MultiplayerEventCallback | null = null;
    mockMpService.setCallbacks = vi.fn((callbacks) => {
      registeredCallbacks = callbacks;
    });

    render(
      <GameCanvas
        multiplayerService={mockMpService as MultiplayerService}
        onGameOver={vi.fn()}
      />
    );

    // Initial score is 0
    expect(screen.getByText(/RANK #1/i)).toBeInTheDocument();
    expect(screen.getByText(/0 PTS/i)).toBeInTheDocument();

    const spawn = getPlayerSpawnPoint(0, 12345);

    // Run frames past initial grace cooldown (2.5s: 27 frames x 0.1s = 2.7s)
    let t = 1000;
    act(() => {
      if (animationCallback) {
        animationCallback(t);
        for (let i = 0; i < 27; i++) {
          t += 100;
          animationCallback(t);
        }
      }
    });

    const calls = (mockMpService.sendPlayerUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const prevSent = calls.at(-2)?.[0] as { x: number; y: number; angle: number } | undefined;
    const lastSent = calls.at(-1)?.[0] as { x: number; y: number; angle: number } | undefined;
    const stepDx = prevSent && lastSent ? lastSent.x - prevSent.x : 0;
    const stepDy = prevSent && lastSent ? lastSent.y - prevSent.y : 0;

    // Spawn a remote peer directly in the player's next frame path
    act(() => {
      registeredCallbacks?.onRemotePlayerUpdate?.({
        id: 'peer_target',
        name: 'RivalRacer',
        color: '#00e5ff',
        x: (lastSent?.x ?? spawn.x) + stepDx,
        y: (lastSent?.y ?? spawn.y) + stepDy,
        angle: lastSent?.angle ?? spawn.angle,
        speed: 50,
        steerVisual: 0,
        isBraking: false,
        score: 0,
        timestamp: Date.now(),
      });
    });

    // Step two frames so the collision triggers regardless of rAF re-registration
    act(() => {
      if (animationCallback) {
        t += 100;
        animationCallback(t);
        t += 100;
        animationCallback(t);
      }
    });

    // Send hit must have been dispatched to peer_target
    expect(mockMpService.sendHit).toHaveBeenCalledWith('peer_target');

    // Local player score received +20 PTS bonus for bumping rival
    expect(screen.getByText(/20 PTS/i)).toBeInTheDocument();
  });

  it('only plays hit sound for onPlayerHit when local player is the target and skips controls overlay in multiplayer', () => {
    const playHitSpy = vi.spyOn(soundService, 'playHitSound');
    let registeredCallbacks: MultiplayerEventCallback | null = null;
    mockMpService.setCallbacks = vi.fn((callbacks) => {
      registeredCallbacks = callbacks;
    });

    render(
      <GameCanvas
        multiplayerService={mockMpService as MultiplayerService}
        onGameOver={vi.fn()}
      />
    );

    // Controls overlay should not block multiplayer start
    expect(screen.queryByText('TOP GEAR 3000 MODE')).not.toBeInTheDocument();

    // Hit between two other peers should be ignored locally
    act(() => {
      registeredCallbacks?.onPlayerHit?.('peer_a', 'peer_b');
    });
    expect(playHitSpy).not.toHaveBeenCalled();

    // Hit targeting local player triggers crash sound
    act(() => {
      registeredCallbacks?.onPlayerHit?.('peer_a', 'local-pilot-id');
    });
    expect(playHitSpy).toHaveBeenCalledWith('CAR');
  });

  it('toggles audio mute button, supports 2-finger touch braking, and aborts solo runs without saving score', () => {
    const onGameOverMock = vi.fn();
    const onBackToMenuMock = vi.fn();

    render(<GameCanvas onGameOver={onGameOverMock} onBackToMenu={onBackToMenuMock} />);

    // 1. Mute button toggles between unmuted and muted
    const muteBtn = screen.getByRole('button', { name: /Alternar Áudio/i });
    expect(muteBtn.textContent).toBe('🔊');
    fireEvent.click(muteBtn);
    expect(muteBtn.textContent).toBe('🔇');
    expect(soundService.isMuted()).toBe(true);
    fireEvent.click(muteBtn);
    expect(muteBtn.textContent).toBe('🔊');
    expect(soundService.isMuted()).toBe(false);

    // 2. Two-finger touch braking triggers without errors and clears on touchEnd
    fireEvent.touchStart(window, {
      touches: [
        { clientX: 200, clientY: 300 },
        { clientX: 600, clientY: 300 },
      ],
    });
    fireEvent.touchMove(window, {
      touches: [
        { clientX: 220, clientY: 300 },
        { clientX: 620, clientY: 300 },
      ],
    });
    fireEvent.touchEnd(window, { touches: [] });

    // 3. ABORT returns to menu via onBackToMenu without invoking onGameOver
    fireEvent.click(screen.getByRole('button', { name: 'ABORT' }));
    expect(onBackToMenuMock).toHaveBeenCalledTimes(1);
    expect(onGameOverMock).not.toHaveBeenCalled();
  });
});
