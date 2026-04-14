import React, { useState } from 'react';
import './NameEntryView.css';
import { LocalStorageService } from '../../services/LocalStorageService';

interface NameEntryViewProps {
  onNameSubmitted: (name: string) => void;
}

export const NameEntryView: React.FC<NameEntryViewProps> = ({ onNameSubmitted }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      LocalStorageService.saveName(name.trim());
      onNameSubmitted(name.trim());
    }
  };

  return (
    <div className="name-entry-container">
      <div className="name-entry-card">
        <h1>ATROPELIS SIMULATOR</h1>
        <p>Enter your nickname to continue:</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Nickname"
            maxLength={15}
            required
            autoFocus
          />
          <button type="submit">CONTINUE</button>
        </form>
      </div>
    </div>
  );
};
