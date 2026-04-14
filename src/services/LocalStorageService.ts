export interface ScoreEntry {
  date: string;
  name: string;
  points: number;
}

const NAME_KEY = 'atropelis_user_name';
const SCORES_KEY = 'atropelis_scores';

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
  }
};
