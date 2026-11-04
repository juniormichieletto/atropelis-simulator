import React from 'react';
import './MenuView.css';
import { soundService } from '../../services/SoundService';

interface MenuViewProps {
  userName: string;
  onStartGame: () => void;
  onShowScoreboard: () => void;
  onChangeName: () => void;
}

export const MenuView: React.FC<MenuViewProps> = ({
  userName,
  onStartGame,
  onShowScoreboard,
  onChangeName,
}) => {
  return (
    <div className="menu-container synthwave-screen">
      <div className="menu-card">
        <div className="edition-badge">3000 HORIZON EDITION</div>
        <h1>ATROPELIS SIMULATOR</h1>
        <p className="welcome-text">PILOT READY: <span className="nickname">{userName}</span></p>
        
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
            CHANGE PILOT
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
