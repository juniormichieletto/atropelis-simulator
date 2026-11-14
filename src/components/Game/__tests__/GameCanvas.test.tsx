import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GameCanvas } from '../GameCanvas';
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
      broadcastHit: vi.fn(),
      leave: vi.fn(),
      getMySpawnIndex: vi.fn(() => 0),
      getSpawnSeed: vi.fn(() => 12345),
    };
  });

  afterEach(() => {
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
});
