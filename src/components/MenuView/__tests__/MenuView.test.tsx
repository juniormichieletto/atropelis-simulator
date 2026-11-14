import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(screen.queryByRole('button', { name: /MODO HORIZONTAL/i })).not.toBeInTheDocument();
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
});
