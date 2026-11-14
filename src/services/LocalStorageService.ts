export interface ScoreEntry {
  date: string;
  name: string;
  points: number;
}

export interface MultiplayerScoreEntry {
  date: string;
  name: string;
  points: number;
  rank: number;
  playersCount: number;
}

const NAME_KEY = 'atropelis_user_name';
const SCORES_KEY = 'atropelis_scores';
const MP_SCORES_KEY = 'atropelis_mp_scores';

export const LocalStorageService = {
  saveName(name: string): void {
    localStorage.setItem(NAME_KEY, name);
  },

  getName(): string | null {
    return localStorage.getItem(NAME_KEY);
  },

  saveScore(points: number): void {
    const name = this.getName() || 'Unknown';
    const scores = this.getScores();
    const newEntry: ScoreEntry = {
      date: new Date().toLocaleDateString(),
      name,
      points,
    };
    scores.push(newEntry);
    // Sort scores by points descending
    scores.sort((a, b) => b.points - a.points);
    // Keep top 100
    const topScores = scores.slice(0, 100);
    localStorage.setItem(SCORES_KEY, JSON.stringify(topScores));
  },

  getScores(): ScoreEntry[] {
    const scoresJson = localStorage.getItem(SCORES_KEY);
    if (!scoresJson) return [];
    try {
      return JSON.parse(scoresJson);
    } catch (e) {
      console.error('Failed to parse scores from LocalStorage', e);
      return [];
    }
  },

  clearScores(): void {
    localStorage.removeItem(SCORES_KEY);
  },

  saveMultiplayerScore(points: number, rank: number = 1, playersCount: number = 1): void {
    const name = this.getName() || 'Unknown';
    const scores = this.getMultiplayerScores();
    const newEntry: MultiplayerScoreEntry = {
      date: new Date().toLocaleDateString(),
      name,
      points,
      rank,
      playersCount,
    };
    scores.push(newEntry);
    scores.sort((a, b) => b.points - a.points);
    const topScores = scores.slice(0, 100);
    localStorage.setItem(MP_SCORES_KEY, JSON.stringify(topScores));
  },

  getMultiplayerScores(): MultiplayerScoreEntry[] {
    const scoresJson = localStorage.getItem(MP_SCORES_KEY);
    if (!scoresJson) return [];
    try {
      return JSON.parse(scoresJson);
    } catch (e) {
      console.error('Failed to parse multiplayer scores from LocalStorage', e);
      return [];
    }
  },

  clearMultiplayerScores(): void {
    localStorage.removeItem(MP_SCORES_KEY);
  },
};
