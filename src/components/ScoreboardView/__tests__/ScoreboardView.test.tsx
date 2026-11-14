import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoreboardView } from '../ScoreboardView';
import { LocalStorageService } from '../../../services/LocalStorageService';

describe('ScoreboardView', () => {
  const onBackMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders solo scores tab by default and switches to multiplayer tab', () => {
    LocalStorageService.saveName('SOLO_PILOT');
    LocalStorageService.saveScore(77);

    LocalStorageService.saveName('MP_PILOT');
    LocalStorageService.saveMultiplayerScore(95, 1, 4);

    render(<ScoreboardView onBack={onBackMock} />);

    expect(screen.getByText('HALL OF FAME')).toBeInTheDocument();
    expect(screen.getByText('MODO SOLO')).toBeInTheDocument();
    expect(screen.getByText('MULTIPLAYER 🌐')).toBeInTheDocument();

    // Solo tab active initially
    expect(screen.getByText('77')).toBeInTheDocument();
    expect(screen.getByText('SOLO_PILOT')).toBeInTheDocument();
    expect(screen.queryByText('RANK')).not.toBeInTheDocument();

    // Switch to Multiplayer tab
    fireEvent.click(screen.getByText('MULTIPLAYER 🌐'));

    expect(screen.getByText('RANK')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
    expect(screen.getByText('MP_PILOT')).toBeInTheDocument();

    // Switch back to Solo tab
    fireEvent.click(screen.getByText('MODO SOLO'));
    expect(screen.getByText('77')).toBeInTheDocument();

    // Back to Menu button
    fireEvent.click(screen.getByText('BACK TO MENU'));
    expect(onBackMock).toHaveBeenCalledTimes(1);
  });

  it('displays empty state message when no scores exist', () => {
    render(<ScoreboardView onBack={onBackMock} />);

    expect(screen.getByText('NO SCORES RECORDED YET')).toBeInTheDocument();

    fireEvent.click(screen.getByText('MULTIPLAYER 🌐'));
    expect(screen.getByText('NO MULTIPLAYER SCORES RECORDED YET')).toBeInTheDocument();
  });
});
