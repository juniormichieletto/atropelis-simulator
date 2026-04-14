import React from 'react';
import './MenuView.css';
import backgroundImage from '../../../initial_screen.png';

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
    <div className="menu-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="menu-card">
        <h1>ATROPELIS SIMULATOR</h1>
        <p className="welcome-text">WELCOME, <span className="nickname">{userName}</span>!</p>
        <div className="menu-buttons">
          <button className="menu-btn start-btn" onClick={onStartGame}>START NEW GAME</button>
          <button className="menu-btn scoreboard-btn" onClick={onShowScoreboard}>SCOREBOARD</button>
          <button className="menu-btn change-name-btn" onClick={onChangeName}>CHANGE NAME</button>
        </div>
      </div>
    </div>
  );
};
