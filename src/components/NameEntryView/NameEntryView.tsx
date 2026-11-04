import React, { useState } from 'react';
import './NameEntryView.css';
import { LocalStorageService } from '../../services/LocalStorageService';
import { soundService } from '../../services/SoundService';

interface NameEntryViewProps {
  onNameSubmitted: (name: string) => void;
}

export const NameEntryView: React.FC<NameEntryViewProps> = ({ onNameSubmitted }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      soundService.playUiSound();
      LocalStorageService.saveName(name.trim());
      onNameSubmitted(name.trim());
    }
  };

  return (
    <div className="name-entry-container synthwave-screen">
      <div className="name-entry-card">
        <h1>ATROPELIS SIMULATOR</h1>
        <p>ENTER PILOT CALLSIGN:</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="PILOT NAME"
            maxLength={15}
            required
            autoFocus
          />
          <button type="submit">ENGAGE</button>
        </form>
      </div>
    </div>
  );
};
