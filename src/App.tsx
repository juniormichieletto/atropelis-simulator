import { useState } from 'react';
import './App.css';
import { NameEntryView } from './components/NameEntryView/NameEntryView';
import { MenuView } from './components/MenuView/MenuView';
import { ScoreboardView } from './components/ScoreboardView/ScoreboardView';
import { GameCanvas } from './components/Game/GameCanvas';
import { MultiplayerLobbyView } from './components/MultiplayerView/MultiplayerLobbyView';
import { LocalStorageService } from './services/LocalStorageService';
import { MultiplayerService } from './services/MultiplayerService';

type View = 'NAME_ENTRY' | 'MENU' | 'GAME' | 'SCOREBOARD' | 'MULTIPLAYER_LOBBY' | 'MULTIPLAYER_GAME';

function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const initialRoom = queryParams.get('room') || queryParams.get('sala') || '';

  const [currentView, setCurrentView] = useState<View>(() => {
    const hasName = Boolean(LocalStorageService.getName());
    if (!hasName) return 'NAME_ENTRY';
    if (initialRoom) return 'MULTIPLAYER_LOBBY';
    return 'MENU';
  });

  const [userName, setUserName] = useState<string>(() => LocalStorageService.getName() || '');
  const [activeMpService, setActiveMpService] = useState<MultiplayerService | null>(null);

  const handleNameSubmitted = (name: string) => {
    setUserName(name);
    if (initialRoom) {
      setCurrentView('MULTIPLAYER_LOBBY');
    } else {
      setCurrentView('MENU');
    }
  };

  const handleStartGame = () => {
    setCurrentView('GAME');
  };

  const handleStartMultiplayer = () => {
    setCurrentView('MULTIPLAYER_LOBBY');
  };

  const handleShowScoreboard = () => {
    setCurrentView('SCOREBOARD');
  };

  const handleChangeName = () => {
    setCurrentView('NAME_ENTRY');
  };

  const handleBackToMenu = () => {
    if (activeMpService) {
      activeMpService.leave();
      setActiveMpService(null);
    }
    setCurrentView('MENU');
  };

  const handleStartMultiplayerGame = (service: MultiplayerService) => {
    setActiveMpService(service);
    setCurrentView('MULTIPLAYER_GAME');
  };

  return (
    <div className="app-container">
      <div className="crt-overlay"></div>
      {currentView === 'NAME_ENTRY' && (
        <NameEntryView onNameSubmitted={handleNameSubmitted} />
      )}
      {currentView === 'MENU' && (
        <MenuView 
          userName={userName} 
          onStartGame={handleStartGame}
          onStartMultiplayer={handleStartMultiplayer}
          onShowScoreboard={handleShowScoreboard}
          onChangeName={handleChangeName}
        />
      )}
      {currentView === 'MULTIPLAYER_LOBBY' && (
        <MultiplayerLobbyView
          userName={userName}
          initialRoomCode={initialRoom}
          onStartMultiplayerGame={handleStartMultiplayerGame}
          onBackToMenu={handleBackToMenu}
        />
      )}
      {currentView === 'SCOREBOARD' && (
        <ScoreboardView onBack={handleBackToMenu} />
      )}
      {currentView === 'GAME' && (
        <GameCanvas onGameOver={(score) => {
          LocalStorageService.saveScore(score);
          setCurrentView('MENU');
        }} />
      )}
      {currentView === 'MULTIPLAYER_GAME' && (
        <GameCanvas
          multiplayerService={activeMpService || undefined}
          onGameOver={() => {
            handleBackToMenu();
          }}
          onBackToMenu={handleBackToMenu}
        />
      )}
    </div>
  );
}

export default App;
