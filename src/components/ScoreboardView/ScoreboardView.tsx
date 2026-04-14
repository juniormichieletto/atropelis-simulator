import React from 'react';
import './ScoreboardView.css';
import { LocalStorageService } from '../../services/LocalStorageService';

interface ScoreboardViewProps {
  onBack: () => void;
}

export const ScoreboardView: React.FC<ScoreboardViewProps> = ({ onBack }) => {
  const scores = LocalStorageService.getScores();

  return (
    <div className="scoreboard-container">
      <div className="scoreboard-card">
        <h1>SCOREBOARD</h1>
        <div className="table-wrapper">
          {scores.length > 0 ? (
            <table className="score-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>NAME</th>
                  <th>POINTS</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score, index) => (
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
          )}
        </div>
        <button className="back-btn" onClick={onBack}>BACK TO MENU</button>
      </div>
    </div>
  );
};
