import React from 'react';
import './MenuView.css';
import backgroundImage from '../../../initial_screen.png';
import { soundService } from '../../services/SoundService';

interface MenuViewProps {
  userName: string;
  onStartGame: () => void;
  onShowScoreboard: () => void;
  onChangeName: () => void;
  onStartMultiplayer?: () => void;
}

interface ElementWithFullscreen extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

export const MenuView: React.FC<MenuViewProps> = ({
  userName,
  onStartGame,
  onShowScoreboard,
  onChangeName,
  onStartMultiplayer,
}) => {
  const handleToggleOrientation = async () => {
    soundService.playUiSound();
    try {
      if (!document.fullscreenElement) {
        const root = document.documentElement as ElementWithFullscreen;
        if (root.requestFullscreen) {
          await root.requestFullscreen();
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
        }
      }
      if ('orientation' in screen && screen.orientation && 'lock' in screen.orientation) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Ignored if unsupported
    }
  };

  return (
    <div className="menu-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="menu-card">
        <h1>ATROPELIS SIMULATOR</h1>
        <p className="welcome-text">WELCOME, <span className="nickname">{userName}</span>!</p>
        
        <div className="menu-buttons">
          <button
            className="menu-btn start-btn"
            onClick={() => {
              soundService.playUiSound();
              onStartGame();
            }}
          >
            START NEW GAME
          </button>
          <button
            className="menu-btn multiplayer-btn"
            onClick={() => {
              soundService.playUiSound();
              onStartMultiplayer?.();
            }}
          >
            MULTIPLAYER ONLINE 🌐
          </button>
          <button
            className="menu-btn scoreboard-btn"
            onClick={() => {
              soundService.playUiSound();
              onShowScoreboard();
            }}
          >
            SCOREBOARD
          </button>
          <button
            className="menu-btn change-name-btn"
            onClick={() => {
              soundService.playUiSound();
              onChangeName();
            }}
          >
            CHANGE NAME
          </button>
          <button
            className="menu-btn orientation-btn"
            onClick={handleToggleOrientation}
          >
            MODO HORIZONTAL 🔄
          </button>
        </div>
      </div>
      <div className="menu-footer">
        <p>Created by <a href="https://github.com/juniormichieletto" target="_blank" rel="noopener noreferrer">AJ (juniormichieletto)</a></p>
        <p><a href="https://juniormichieletto.github.io/atropelis-simulator/" target="_blank" rel="noopener noreferrer">GitHub Repository</a></p>
      </div>
    </div>
  );
};
