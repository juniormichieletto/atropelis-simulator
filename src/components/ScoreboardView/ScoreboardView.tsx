import React, { useState } from 'react';
import './ScoreboardView.css';
import { LocalStorageService } from '../../services/LocalStorageService';
import { soundService } from '../../services/SoundService';

interface ScoreboardViewProps {
  onBack: () => void;
}

export const ScoreboardView: React.FC<ScoreboardViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'SOLO' | 'MULTIPLAYER'>('SOLO');
  const soloScores = LocalStorageService.getScores();
  const mpScores = LocalStorageService.getMultiplayerScores();

  return (
    <div className="scoreboard-container synthwave-screen">
      <div className="scoreboard-card">
        <h1>HALL OF FAME</h1>

        <div className="sb-tabs">
          <button
            className={`sb-tab-btn ${activeTab === 'SOLO' ? 'active' : ''}`}
            onClick={() => {
              soundService.playUiSound();
              setActiveTab('SOLO');
            }}
          >
            MODO SOLO
          </button>
          <button
            className={`sb-tab-btn ${activeTab === 'MULTIPLAYER' ? 'active' : ''}`}
            onClick={() => {
              soundService.playUiSound();
              setActiveTab('MULTIPLAYER');
            }}
          >
            MULTIPLAYER 🌐
          </button>
        </div>

        <div className="table-wrapper">
          {activeTab === 'SOLO' ? (
            soloScores.length > 0 ? (
              <table className="score-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>PILOT</th>
                    <th>POINTS</th>
                  </tr>
                </thead>
                <tbody>
                  {soloScores.map((score, index) => (
                    <tr key={`${score.date}-${score.name}-${index}`}>
                      <td>{score.date}</td>
                      <td>{score.name}</td>
                      <td className="points-cell">{score.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-scores">NO SCORES RECORDED YET</p>
            )
          ) : (
            mpScores.length > 0 ? (
              <table className="score-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>PILOT</th>
                    <th>RANK</th>
                    <th>PILOTS</th>
                    <th>POINTS</th>
                  </tr>
                </thead>
                <tbody>
                  {mpScores.map((score, index) => (
                    <tr key={`${score.date}-${score.name}-${index}`}>
                      <td>{score.date}</td>
                      <td>{score.name}</td>
                      <td className="rank-cell">#{score.rank}</td>
                      <td>{score.playersCount}</td>
                      <td className="points-cell">{score.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-scores">NO MULTIPLAYER SCORES RECORDED YET</p>
            )
          )}
        </div>
        <button
          className="back-btn"
          onClick={() => {
            soundService.playUiSound();
            onBack();
          }}
        >
          BACK TO MENU
        </button>
      </div>
    </div>
  );
};
