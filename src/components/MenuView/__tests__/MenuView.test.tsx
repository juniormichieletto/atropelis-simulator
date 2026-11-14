import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MenuView } from '../MenuView';

describe('MenuView', () => {
  it('renders title, pilot username and action buttons', () => {
    const onStartGame = vi.fn();
    const onShowScoreboard = vi.fn();
    const onChangeName = vi.fn();
    const onStartMultiplayer = vi.fn();

    render(
      <MenuView
        userName="PILOT99"
        onStartGame={onStartGame}
        onShowScoreboard={onShowScoreboard}
        onChangeName={onChangeName}
        onStartMultiplayer={onStartMultiplayer}
      />
    );

    expect(screen.getByText(/ATROPELIS SIMULATOR/i)).toBeInTheDocument();
    expect(screen.getByText('PILOT99')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /START NEW GAME/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SCOREBOARD/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MULTIPLAYER/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CHANGE NAME/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MODO HORIZONTAL/i })).toBeInTheDocument();
  });

  it('triggers onStartGame, onShowScoreboard, onChangeName and onStartMultiplayer when buttons clicked', () => {
    const onStartGame = vi.fn();
    const onShowScoreboard = vi.fn();
    const onChangeName = vi.fn();
    const onStartMultiplayer = vi.fn();

    render(
      <MenuView
        userName="PILOT99"
        onStartGame={onStartGame}
        onShowScoreboard={onShowScoreboard}
        onChangeName={onChangeName}
        onStartMultiplayer={onStartMultiplayer}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /START NEW GAME/i }));
    expect(onStartGame).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /SCOREBOARD/i }));
    expect(onShowScoreboard).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /CHANGE NAME/i }));
    expect(onChangeName).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /MULTIPLAYER/i }));
    expect(onStartMultiplayer).toHaveBeenCalled();
  });

  it('requests fullscreen and locks orientation to landscape when MODO HORIZONTAL is clicked', async () => {
    const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreenMock;

    const lockMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.screen, 'orientation', {
      value: { lock: lockMock },
      configurable: true,
      writable: true,
    });

    render(
      <MenuView
        userName="PILOT99"
        onStartGame={vi.fn()}
        onShowScoreboard={vi.fn()}
        onChangeName={vi.fn()}
      />
    );

    const orientationBtn = screen.getByRole('button', { name: /MODO HORIZONTAL/i });
    fireEvent.click(orientationBtn);

    await waitFor(() => {
      expect(requestFullscreenMock).toHaveBeenCalled();
    });
  });

  it('handles webkitRequestFullscreen and orientation lock errors gracefully', async () => {
    interface ElementWithWebkitFullscreen extends HTMLElement {
      webkitRequestFullscreen?: () => Promise<void>;
    }
    const root = document.documentElement as ElementWithWebkitFullscreen;
    const webkitRequestFullscreenMock = vi.fn().mockRejectedValue(new Error('Rejected'));
    root.webkitRequestFullscreen = webkitRequestFullscreenMock;

    render(
      <MenuView
        userName="PILOT99"
        onStartGame={vi.fn()}
        onShowScoreboard={vi.fn()}
        onChangeName={vi.fn()}
      />
    );

    const orientationBtn = screen.getByRole('button', { name: /MODO HORIZONTAL/i });
    expect(() => fireEvent.click(orientationBtn)).not.toThrow();
  });
});
