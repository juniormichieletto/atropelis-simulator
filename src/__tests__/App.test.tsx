import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';
import { LocalStorageService } from '../services/LocalStorageService';
import { soundService } from '../services/SoundService';

describe('App & GameCanvas Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates across all views, steps the 3D game loop, handles pointer steering, and saves scores on timer end', () => {
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });

    render(<App />);

    // 1. Starts on Name Entry when no pilot name is stored
    expect(screen.getByText(/ENTER PILOT CALLSIGN/i)).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/PILOT NAME/i);
    fireEvent.change(input, { target: { value: 'RUNNER3000' } });
    fireEvent.click(screen.getByRole('button', { name: /ENGAGE/i }));

    // 2. Arrives on MenuView showing pilot name; test Change Name flow
    expect(screen.getByText(/RUNNER3000/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /CHANGE NAME/i }));
    expect(screen.getByText(/ENTER PILOT CALLSIGN/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/PILOT NAME/i), { target: { value: 'ACE3000' } });
    fireEvent.click(screen.getByRole('button', { name: /ENGAGE/i }));
    expect(screen.getByText(/ACE3000/i)).toBeInTheDocument();

    // 3. Seed a score and open Scoreboard
    LocalStorageService.saveScore(95);
    fireEvent.click(screen.getByRole('button', { name: /SCOREBOARD/i }));
    expect(screen.getByText(/HALL OF FAME/i)).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /BACK TO MENU/i }));

    // 4. Start Game -> shows Top Gear 3000 HUD & Controls overlay
    fireEvent.click(screen.getByRole('button', { name: /START NEW GAME/i }));
    expect(screen.getByText(/TOP GEAR 3000 MODE/i)).toBeInTheDocument();

    // Dismiss controls overlay via keyboard key
    fireEvent.keyDown(window, { code: 'KeyW', key: 'w' });

    // Simulate mouse & touch steering interactions on canvas
    fireEvent.mouseDown(window, { clientX: 200, clientY: 300 });
    fireEvent.mouseMove(window, { clientX: 800, clientY: 300 });
    fireEvent.mouseUp(window);

    fireEvent.touchStart(window, { touches: [{ clientX: 150, clientY: 300 }] });
    fireEvent.touchMove(window, { touches: [{ clientX: 900, clientY: 300 }] });
    fireEvent.touchEnd(window);

    // Step the requestAnimationFrame game loop (update + draw)
    act(() => {
      if (rafCallback) rafCallback(1000);
      if (rafCallback) rafCallback(1050);
      if (rafCallback) rafCallback(1100);
    });

    // Advance 60-second game timer to trigger automatic Game Over
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Returns to MenuView after timer expires
    expect(screen.getByText(/START NEW GAME/i)).toBeInTheDocument();
  });

  it('pauses the game loop, countdown timer, and music when the tab becomes hidden and resumes on return', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const pauseAudioSpy = vi.spyOn(soundService, 'pauseBackgroundMusic');
    const resumeAudioSpy = vi.spyOn(soundService, 'resumeBackgroundMusic');

    LocalStorageService.saveName('ACE3000');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /START NEW GAME/i }));
    expect(screen.getByText(/TIME: 1:00/i)).toBeInTheDocument();

    try {
      // Switch away from tab (document.hidden = true)
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(pauseAudioSpy).toHaveBeenCalledTimes(1);
      expect(cafSpy).toHaveBeenCalled();

      // Timer must not tick down while tab is hidden
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(screen.getByText(/TIME: 1:00/i)).toBeInTheDocument();

      rafSpy.mockClear();

      // Return to tab (document.hidden = false)
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(resumeAudioSpy).toHaveBeenCalledTimes(1);
      expect(rafSpy).toHaveBeenCalled();

      // Timer resumes decrementing normally
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText(/TIME: 0:55/i)).toBeInTheDocument();
    } finally {
      delete (document as unknown as { hidden?: boolean }).hidden;
      vi.restoreAllMocks();
    }
  });

  it('navigates to Multiplayer Lobby from Menu and returns to Menu cleanly', () => {
    LocalStorageService.saveName('MULTI_RACER');
    render(<App />);

    expect(screen.getByText(/MULTIPLAYER ONLINE/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/MULTIPLAYER ONLINE/i));

    expect(screen.getByText('CRIAR UMA SALA')).toBeInTheDocument();
    fireEvent.click(screen.getByText('VOLTAR AO MENU PRINCIPAL'));

    expect(screen.getByText(/START NEW GAME/i)).toBeInTheDocument();
  });

  it('clears ?sala= query param after leaving lobby so changing name returns to Menu', () => {
    LocalStorageService.saveName('INVITED_PILOT');
    window.history.replaceState({}, '', '/?sala=INVITE99');

    render(<App />);

    // Starts directly in Multiplayer Lobby due to ?sala=INVITE99
    expect(screen.getByText('MULTIPLAYER ONLINE')).toBeInTheDocument();

    // Return to Main Menu -> query param and initialRoom should be cleared
    fireEvent.click(screen.getByText('VOLTAR AO MENU PRINCIPAL'));
    expect(screen.getByText(/START NEW GAME/i)).toBeInTheDocument();
    expect(window.location.search).toBe('');

    // Change name -> returns to Menu instead of being trapped in Multiplayer Lobby
    fireEvent.click(screen.getByRole('button', { name: /CHANGE NAME/i }));
    fireEvent.change(screen.getByPlaceholderText(/PILOT NAME/i), { target: { value: 'NEW_ACE' } });
    fireEvent.click(screen.getByRole('button', { name: /ENGAGE/i }));
    expect(screen.getByText(/START NEW GAME/i)).toBeInTheDocument();
  });
});
