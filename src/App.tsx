import { useState, useEffect } from 'react';
import './App.css';
import { NameEntryView } from './components/NameEntryView/NameEntryView';
import { MenuView } from './components/MenuView/MenuView';
import { ScoreboardView } from './components/ScoreboardView/ScoreboardView';
import { GameCanvas } from './components/Game/GameCanvas';
import { LocalStorageService } from './services/LocalStorageService';

type View = 'NAME_ENTRY' | 'MENU' | 'GAME' | 'SCOREBOARD';

function App() {
  const [currentView, setCurrentView] = useState<View>('NAME_ENTRY');
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const savedName = LocalStorageService.getName();
    if (savedName) {
      setUserName(savedName);
      setCurrentView('MENU');
    } else {
      setCurrentView('NAME_ENTRY');
    }
  }, []);

  const handleNameSubmitted = (name: string) => {
    setUserName(name);
    setCurrentView('MENU');
  };

  const handleStartGame = () => {
    setCurrentView('GAME');
  };

  const handleShowScoreboard = () => {
    setCurrentView('SCOREBOARD');
  };

  const handleChangeName = () => {
    setCurrentView('NAME_ENTRY');
  };

  const handleBackToMenu = () => {
    setCurrentView('MENU');
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
          onShowScoreboard={handleShowScoreboard}
          onChangeName={handleChangeName}
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
    </div>
  );
}

export default App;
