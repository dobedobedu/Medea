import { useState, useEffect, useCallback } from 'react';

// Simple interface for word progress tracking
interface WordProgress {
  current_word_index: number;
  mastered_words: string[];
  struggling_words: string[];
  word_attempts: Record<string, { attempts: number; understood: boolean; last_practiced: string }>;
  word_list: string[];
}

const DEFAULT_WORD_PROGRESS: WordProgress = {
  current_word_index: 0,
  mastered_words: [],
  struggling_words: [],
  word_attempts: {},
  word_list: [
    "acknowledge",
    "original",
    "originate",
    "origin",
    "aborigine",
    "initial",
    "initiate",
    "initiative",
    "archaic",
    "archive",
    "archaeology",
    "assignment",
    "project",
    "presentation",
    "recess",
    "cafeteria",
    "principal",
    "permission",
    "excuse",
    "locker",
    "hallway"
  ]
};

// Simple client-side word progress tracker
class SimpleWordProgressTracker {
  private storage: globalThis.Storage | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.storage = window.localStorage;
    }
  }

  loadProgress(): WordProgress {
    try {
      if (!this.storage) {
        return { ...DEFAULT_WORD_PROGRESS };
      }

      const stored = this.storage.getItem('jason_word_progress');
      return stored ? JSON.parse(stored) : { ...DEFAULT_WORD_PROGRESS };
    } catch (error) {
      console.error('Error loading word progress:', error);
      return { ...DEFAULT_WORD_PROGRESS };
    }
  }

  saveProgress(progress: WordProgress): void {
    try {
      if (!this.storage) return;
      this.storage.setItem('jason_word_progress', JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving word progress:', error);
    }
  }

  getCurrentWord(): string {
    const progress = this.loadProgress();
    return progress.word_list[progress.current_word_index] || progress.word_list[0];
  }

  recordWordAttempt(word: string, understood: boolean): void {
    const progress = this.loadProgress();

    // Record attempt
    if (!progress.word_attempts[word]) {
      progress.word_attempts[word] = {
        attempts: 0,
        understood: false,
        last_practiced: new Date().toISOString()
      };
    }

    progress.word_attempts[word].attempts++;
    progress.word_attempts[word].understood = understood;
    progress.word_attempts[word].last_practiced = new Date().toISOString();

    // If understood, mark as mastered and move to next word
    if (understood) {
      if (!progress.mastered_words.includes(word)) {
        progress.mastered_words.push(word);
      }

      // Remove from struggling if it was there
      progress.struggling_words = progress.struggling_words.filter(w => w !== word);

      // Move to next word
      if (progress.word_list.indexOf(word) === progress.current_word_index) {
        progress.current_word_index++;
      }
    } else {
      // Add to struggling if not understood after multiple attempts
      if (progress.word_attempts[word].attempts >= 2 && !progress.struggling_words.includes(word)) {
        progress.struggling_words.push(word);
      }
    }

    this.saveProgress(progress);
  }

  getProgressSummary() {
    const progress = this.loadProgress();
    return {
      currentWord: this.getCurrentWord(),
      currentIndex: progress.current_word_index,
      totalWords: progress.word_list.length,
      masteredCount: progress.mastered_words.length,
      strugglingCount: progress.struggling_words.length,
      wordsRemaining: progress.word_list.length - progress.current_word_index,
      recentWords: progress.mastered_words.slice(-5)
    };
  }
}

const wordProgressTracker = new SimpleWordProgressTracker();

export interface ProgressUpdateData {
  word: string;
  understood: boolean;
}

export function useWordProgress() {
  const [progress, setProgress] = useState<WordProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial progress
  useEffect(() => {
    try {
      setLoading(true);
      setError(null);

      const clientProgress = wordProgressTracker.loadProgress();
      setProgress(clientProgress);

      // Optionally sync with server
      // try {
      //   const response = await fetch('/api/word-progress');
      //   if (response.ok) {
      //     const result = await response.json();
      //     if (result.success && result.data) {
      //       const merged = { ...clientProgress, ...result.data };
      //       setProgress(merged);
      //       wordProgressTracker.saveProgress(merged);
      //     }
      //   }
      // } catch (serverError) {
      //   console.warn('Server sync failed, using local data:', serverError);
      // }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load word progress';
      setError(errorMessage);
      console.error('Error loading word progress:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update progress locally
  const updateProgress = useCallback(async (updateData: ProgressUpdateData) => {
    if (!progress) return;

    try {
      wordProgressTracker.recordWordAttempt(updateData.word, updateData.understood);

      // Reload progress from tracker to get updated state
      const newProgress = wordProgressTracker.loadProgress();
      setProgress(newProgress);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update word progress';
      setError(errorMessage);
      console.error('Error updating word progress:', err);
      return { success: false, error: errorMessage };
    }
  }, [progress]);

  // Get current word
  const getCurrentWord = useCallback(() => {
    return wordProgressTracker.getCurrentWord();
  }, []);

  // Get progress summary
  const getProgressSummary = useCallback(() => {
    return wordProgressTracker.getProgressSummary();
  }, []);

  // Reset progress
  const resetProgress = useCallback(async () => {
    try {
      wordProgressTracker.saveProgress({ ...DEFAULT_WORD_PROGRESS });
      const newProgress = wordProgressTracker.loadProgress();
      setProgress(newProgress);
      setError(null);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset word progress';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  return {
    progress,
    loading,
    error,
    updateProgress,
    getCurrentWord,
    getProgressSummary,
    resetProgress,
  };
}

// Export types
export type { WordProgress };