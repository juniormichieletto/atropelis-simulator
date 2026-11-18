import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiplayerLobbyView } from '../MultiplayerLobbyView';

const mockLeave = vi.fn();

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
      leave: mockLeave,
    })),
  };
});

describe('MultiplayerLobbyView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders lobby setup view with color picker and action buttons', () => {
    const onStartMultiplayerGame = vi.fn();
    const onBackToMenu = vi.fn();

    render(
      <MultiplayerLobbyView
        userName="Speedy"
        onStartMultiplayerGame={onStartMultiplayerGame}
        onBackToMenu={onBackToMenu}
      />
    );

    expect(screen.getByText('MULTIPLAYER ONLINE')).toBeInTheDocument();
    expect(screen.getByText('CRIAR UMA SALA')).toBeInTheDocument();
    expect(screen.getByText('ENTRAR EM UMA SALA')).toBeInTheDocument();
    expect(screen.getByText('VOLTAR AO MENU PRINCIPAL')).toBeInTheDocument();

    // Back to menu button
    fireEvent.click(screen.getByText('VOLTAR AO MENU PRINCIPAL'));
    expect(onBackToMenu).toHaveBeenCalled();
  });

  it('allows picking a car color and typing a room code', () => {
    render(
      <MultiplayerLobbyView
        userName="Racer"
        onStartMultiplayerGame={vi.fn()}
        onBackToMenu={vi.fn()}
      />
    );

    // Find room code input
    const input = screen.getByPlaceholderText('EX: ATRO42') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'room99' } });
    expect(input.value).toBe('ROOM99');

    // Click on a color button
    const colorButtons = screen.getAllByRole('button');
    const colorBtn = colorButtons.find((b) => b.classList.contains('mp-color-btn'));
    if (colorBtn) {
      fireEvent.click(colorBtn);
      expect(colorBtn).toHaveClass('active');
    }
  });

  it('creates room and transitions to in-room view with copy link and start button', async () => {
    render(
      <MultiplayerLobbyView
        userName="HostUser"
        onStartMultiplayerGame={vi.fn()}
        onBackToMenu={vi.fn()}
      />
    );

    const createBtn = screen.getByText('CRIAR SALA');
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText(/SALA:/i)).toBeInTheDocument();
    });

    expect(screen.getByText('INICIAR CORRIDA 🏁')).toBeInTheDocument();
    expect(screen.getByText('SAIR DA SALA')).toBeInTheDocument();
    expect(screen.getByText('🔗 COPIAR LINK DE CONVITE')).toBeInTheDocument();

    // Leaving room returns to setup
    fireEvent.click(screen.getByText('SAIR DA SALA'));
    expect(screen.getByText('CRIAR UMA SALA')).toBeInTheDocument();
  });

  it('joins room directly when typing a code and clicking ENTRAR NA SALA', async () => {
    render(
      <MultiplayerLobbyView
        userName="GuestUser"
        onStartMultiplayerGame={vi.fn()}
        onBackToMenu={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('EX: ATRO42') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ATRO99' } });

    const joinBtn = screen.getByText('ENTRAR NA SALA');
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(screen.getByText(/SALA:/i)).toBeInTheDocument();
    });
  });

  it('leaves the P2P room cleanly when unmounted before starting the match', async () => {
    const { unmount } = render(
      <MultiplayerLobbyView
        userName="LeaverUser"
        onStartMultiplayerGame={vi.fn()}
        onBackToMenu={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('CRIAR SALA'));
    await waitFor(() => {
      expect(screen.getByText(/SALA:/i)).toBeInTheDocument();
    });

    mockLeave.mockClear();
    unmount();
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });
});
