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
        
        <div className="project-explanation">
          <p className="lang-en">"🎮 PRO TIP: This game was made because a certain friend of ours thinks he's playing GTA in real life. We built this simulator so he can practice his 'creative driving' without involving actual insurance companies. Drive safe (unlike him)!"</p>
          <p className="lang-pt">"🎮 DICA PRO: Esse jogo foi feito porque um certo amigo acha que a vida é GTA. Criamos esse simulador pra ele treinar a 'direção criativa' dele sem precisar acionar o seguro na vida real. Dirija com cuidado (ao contrário dele)!"</p>
        </div>

        <div className="menu-buttons">
          <button className="menu-btn start-btn" onClick={onStartGame}>START NEW GAME</button>
          <button className="menu-btn scoreboard-btn" onClick={onShowScoreboard}>SCOREBOARD</button>
          <button className="menu-btn change-name-btn" onClick={onChangeName}>CHANGE NAME</button>
        </div>
      </div>
      <div className="menu-footer">
        <p>Created by <a href="https://github.com/juniormichieletto" target="_blank" rel="noopener noreferrer">AJ (juniormichieletto)</a></p>
        <p><a href="https://juniormichieletto.github.io/atropelis-simulator/" target="_blank" rel="noopener noreferrer">GitHub Repository</a></p>
      </div>
    </div>
  );
};
