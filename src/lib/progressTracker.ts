interface VocabularyWord {
  word: string;
  definition: string;
  pronunciation_attempts: number;
  pronunciation_clear: boolean;
  meaning_understood: boolean;
  used_in_sentence: boolean;
  last_practiced: string; // ISO date
  difficulty_rating: number; // 1-5 scale
}

interface PronunciationSession {
  date: string; // ISO date
  duration_minutes: number;
  sounds_practiced: string[];
  improvement_notes: string;
  confidence_rating: number; // 1-5 scale
}

interface JasonProgress {
  student_name: string;
  created_date: string;
  last_session: string;

  // Vocabulary Progress
  vocabulary_mastered: string[]; // words he knows well
  vocabulary_in_progress: VocabularyWord[]; // currently learning
  vocabulary_needs_review: string[]; // words to revisit

  // Pronunciation Progress
  pronunciation_sessions: PronunciationSession[];
  problem_sounds: string[]; // sounds he struggles with
  improved_sounds: string[]; // sounds that have gotten better

  // Session Stats
  total_sessions: number;
  total_vocabulary_words: number;
  confidence_score: number; // 1-5 scale
  streak_days: number; // consecutive days practiced

  // Recent Activity
  recent_words_practiced: string[]; // last 10 words
  recent_pronunciation_focus: string[]; // last 5 sounds worked on
}

const DEFAULT_PROGRESS: JasonProgress = {
  student_name: "Jason",
  created_date: new Date().toISOString(),
  last_session: new Date().toISOString(),

  vocabulary_mastered: [],
  vocabulary_in_progress: [],
  vocabulary_needs_review: [],

  pronunciation_sessions: [],
  problem_sounds: [],
  improved_sounds: [],

  total_sessions: 0,
  total_vocabulary_words: 0,
  confidence_score: 3,
  streak_days: 0,

  recent_words_practiced: [],
  recent_pronunciation_focus: [],
};

// Storage keys for Vercel compatibility
const PROGRESS_KEY = "jason_vocabulary_progress";
const BACKUP_KEY = "jason_progress_backup";

export class ProgressTracker {
  private storage: globalThis.Storage | null = null;

  constructor() {
    // Initialize storage for browser environment
    if (typeof window !== 'undefined') {
      this.storage = window.localStorage;
    }
  }

  // Load progress from localStorage or return default
  loadProgress(): JasonProgress {
    try {
      if (!this.storage) {
        console.warn('Storage not available, returning default progress');
        return { ...DEFAULT_PROGRESS };
      }

      const stored = this.storage.getItem(PROGRESS_KEY);
      if (!stored) {
        // First time - initialize with default
        this.saveProgress(DEFAULT_PROGRESS);
        return { ...DEFAULT_PROGRESS };
      }

      const progress = JSON.parse(stored);

      // Validate and merge with default to handle schema changes
      const merged = { ...DEFAULT_PROGRESS, ...progress };
      return merged;
    } catch (error) {
      console.error('Error loading progress:', error);
      // Try backup
      return this.loadBackupProgress();
    }
  }

  // Save progress to localStorage with backup
  saveProgress(progress: JasonProgress): void {
    try {
      if (!this.storage) {
        console.warn('Storage not available, cannot save progress');
        return;
      }

      // Update timestamps
      progress.last_session = new Date().toISOString();

      // Save main progress
      this.storage.setItem(PROGRESS_KEY, JSON.stringify(progress));

      // Create backup copy with timestamp
      const backup = {
        ...progress,
        backup_timestamp: new Date().toISOString(),
      };
      this.storage.setItem(BACKUP_KEY, JSON.stringify(backup));

      console.log('Progress saved successfully');
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }

  // Load backup progress if main is corrupted
  private loadBackupProgress(): JasonProgress {
    try {
      if (!this.storage) {
        return { ...DEFAULT_PROGRESS };
      }

      const backup = this.storage.getItem(BACKUP_KEY);
      if (backup) {
        const progress = JSON.parse(backup);
        console.log('Loaded backup progress');
        return { ...DEFAULT_PROGRESS, ...progress };
      }
    } catch (error) {
      console.error('Error loading backup:', error);
    }

    return { ...DEFAULT_PROGRESS };
  }

  // Record vocabulary practice session
  recordVocabularyPractice(
    word: string,
    definition: string,
    pronunciationClear: boolean,
    meaningUnderstood: boolean,
    usedInSentence: boolean,
    difficultyRating: number = 3
  ): void {
    const progress = this.loadProgress();

    // Check if word is already in progress
    const existingIndex = progress.vocabulary_in_progress.findIndex(w => w.word === word);

    if (existingIndex >= 0) {
      // Update existing word
      const existingWord = progress.vocabulary_in_progress[existingIndex];
      existingWord.pronunciation_attempts++;
      existingWord.pronunciation_clear = pronunciationClear || existingWord.pronunciation_clear;
      existingWord.meaning_understood = meaningUnderstood || existingWord.meaning_understood;
      existingWord.used_in_sentence = usedInSentence || existingWord.used_in_sentence;
      existingWord.last_practiced = new Date().toISOString();
      existingWord.difficulty_rating = Math.min(5, Math.max(1, difficultyRating));

      // Check if word is mastered (all criteria met)
      if (existingWord.pronunciation_clear &&
          existingWord.meaning_understood &&
          existingWord.used_in_sentence &&
          existingWord.pronunciation_attempts >= 2) {
        progress.vocabulary_mastered.push(word);
        progress.vocabulary_in_progress.splice(existingIndex, 1);
      }
    } else {
      // Add new word
      const newWord: VocabularyWord = {
        word,
        definition,
        pronunciation_attempts: 1,
        pronunciation_clear: pronunciationClear,
        meaning_understood: meaningUnderstood,
        used_in_sentence: usedInSentence,
        last_practiced: new Date().toISOString(),
        difficulty_rating: difficultyRating,
      };

      progress.vocabulary_in_progress.push(newWord);

      // Add to recent words (keep last 10)
      progress.recent_words_practiced = [word, ...progress.recent_words_practiced.slice(0, 9)];
    }

    // Update session stats
    progress.total_sessions++;
    progress.total_vocabulary_words++;
    progress.last_session = new Date().toISOString();

    this.saveProgress(progress);
  }

  // Record pronunciation coaching session
  recordPronunciationSession(
    soundsPracticed: string[],
    durationMinutes: number,
    improvementNotes: string,
    confidenceRating: number
  ): void {
    const progress = this.loadProgress();

    const session: PronunciationSession = {
      date: new Date().toISOString(),
      duration_minutes: durationMinutes,
      sounds_practiced: soundsPracticed,
      improvement_notes: improvementNotes,
      confidence_rating: confidenceRating,
    };

    progress.pronunciation_sessions.push(session);

    // Update problem sounds based on recent sessions
    soundsPracticed.forEach(sound => {
      if (!progress.improved_sounds.includes(sound)) {
        if (!progress.problem_sounds.includes(sound)) {
          progress.problem_sounds.push(sound);
        }
      }
    });

    // Update recent pronunciation focus (keep last 5)
    progress.recent_pronunciation_focus = [
      ...soundsPracticed,
      ...progress.recent_pronunciation_focus.filter(s => !soundsPracticed.includes(s))
    ].slice(0, 5);

    // Update overall confidence (rolling average)
    const recentSessions = progress.pronunciation_sessions.slice(-5); // Last 5 sessions
    const avgConfidence = recentSessions.reduce((sum, s) => sum + s.confidence_rating, 0) / recentSessions.length;
    progress.confidence_score = Math.round(avgConfidence * 10) / 10; // Round to 1 decimal

    progress.total_sessions++;
    progress.last_session = new Date().toISOString();

    this.saveProgress(progress);
  }

  // Mark sound as improved
  markSoundImproved(sound: string): void {
    const progress = this.loadProgress();

    if (progress.problem_sounds.includes(sound)) {
      progress.problem_sounds = progress.problem_sounds.filter(s => s !== sound);
    }

    if (!progress.improved_sounds.includes(sound)) {
      progress.improved_sounds.push(sound);
    }

    this.saveProgress(progress);
  }

  // Get words that need review
  getWordsForReview(): string[] {
    const progress = this.loadProgress();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // 1 week ago

    return progress.vocabulary_in_progress
      .filter(word => new Date(word.last_practiced) < cutoffDate)
      .map(word => word.word);
  }

  // Get progress summary for UI
  getProgressSummary() {
    const progress = this.loadProgress();

    return {
      totalWordsLearned: progress.vocabulary_mastered.length,
      currentWordsInProgress: progress.vocabulary_in_progress.length,
      pronunciationSessionsCount: progress.pronunciation_sessions.length,
      currentConfidenceScore: progress.confidence_score,
      streakDays: this.calculateStreak(progress),
      recentWords: progress.recent_words_practiced.slice(0, 5),
      problemSounds: progress.problem_sounds,
      improvedSounds: progress.improved_sounds,
    };
  }

  // Calculate practice streak
  private calculateStreak(progress: JasonProgress): number {
    if (progress.pronunciation_sessions.length === 0) return 0;

    const sessions = progress.pronunciation_sessions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const session of sessions) {
      const sessionDate = new Date(session.date);
      sessionDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === streak) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  // Export progress as JSON for backup
  exportProgress(): string {
    const progress = this.loadProgress();
    return JSON.stringify(progress, null, 2);
  }

  // Import progress from JSON
  importProgress(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData);

      // Validate structure
      if (!imported.student_name || !imported.vocabulary_mastered) {
        throw new Error('Invalid progress data structure');
      }

      // Merge with existing progress, preserving created_date if it exists
      const currentProgress = this.loadProgress();
      const merged = {
        ...currentProgress,
        ...imported,
        created_date: currentProgress.created_date, // Keep original creation date
      };

      this.saveProgress(merged);
      return true;
    } catch (error) {
      console.error('Error importing progress:', error);
      return false;
    }
  }

  // Reset progress (use with caution)
  resetProgress(): void {
    this.saveProgress({ ...DEFAULT_PROGRESS });
  }
}

// Export singleton instance
export const progressTracker = new ProgressTracker();

// Export types for use in components
export type { JasonProgress, VocabularyWord, PronunciationSession };