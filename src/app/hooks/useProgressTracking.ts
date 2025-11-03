import { useState, useEffect, useCallback } from 'react';

// Types for progress tracking
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
  vocabulary_mastered: string[];
  vocabulary_in_progress: VocabularyWord[];
  vocabulary_needs_review: string[];
  pronunciation_sessions: PronunciationSession[];
  problem_sounds: string[];
  improved_sounds: string[];
  total_sessions: number;
  total_vocabulary_words: number;
  confidence_score: number;
  streak_days: number;
  recent_words_practiced: string[];
  recent_pronunciation_focus: string[];
}

// Simple client-side progress tracker (for production compatibility)
class SimpleProgressTracker {
  private storage: globalThis.Storage | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.storage = window.localStorage;
    }
  }

  loadProgress(): JasonProgress {
    try {
      if (!this.storage) {
        return {
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
      }

      const stored = this.storage.getItem('jason_vocabulary_progress');
      return stored ? JSON.parse(stored) : {
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
    } catch (error) {
      console.error('Error loading progress:', error);
      return {
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
    }
  }

  saveProgress(progress: JasonProgress): void {
    try {
      if (!this.storage) return;
      progress.last_session = new Date().toISOString();
      this.storage.setItem('jason_vocabulary_progress', JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }

  recordVocabularyPractice(
    word: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    definition: string,
    pronunciationClear: boolean,
    meaningUnderstood: boolean,
    usedInSentence: boolean
  ): void {
    const progress = this.loadProgress();
    progress.total_sessions++;
    progress.total_vocabulary_words++;
    progress.last_session = new Date().toISOString();

    // Add to recent words
    progress.recent_words_practiced = [word, ...progress.recent_words_practiced.slice(0, 9)];

    this.saveProgress(progress);
  }

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
    progress.total_sessions++;
    progress.last_session = new Date().toISOString();

    // Update recent pronunciation focus
    progress.recent_pronunciation_focus = [
      ...soundsPracticed,
      ...progress.recent_pronunciation_focus.filter(s => !soundsPracticed.includes(s))
    ].slice(0, 5);

    this.saveProgress(progress);
  }

  getProgressSummary() {
    const progress = this.loadProgress();
    return {
      totalWordsLearned: progress.vocabulary_mastered.length,
      currentWordsInProgress: progress.vocabulary_in_progress.length,
      pronunciationSessionsCount: progress.pronunciation_sessions.length,
      currentConfidenceScore: progress.confidence_score,
      streakDays: 1, // Simplified
      recentWords: progress.recent_words_practiced.slice(0, 5),
      problemSounds: progress.problem_sounds,
      improvedSounds: progress.improved_sounds,
    };
  }
}

const progressTracker = new SimpleProgressTracker();

// Export types for use in components
export type { JasonProgress, VocabularyWord, PronunciationSession };

export interface ProgressUpdateData {
  vocabulary?: {
    word: string;
    definition: string;
    pronunciation_clear: boolean;
    meaning_understood: boolean;
    used_in_sentence: boolean;
    difficulty_rating?: number;
  };
  pronunciation?: {
    sounds_practiced: string[];
    duration_minutes: number;
    improvement_notes: string;
    confidence_rating: number;
  };
  sound_improved?: {
    sound: string;
  };
}

export function useProgressTracking() {
  const [progress, setProgress] = useState<JasonProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial progress
  useEffect(() => {
    const loadProgress = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load from localStorage (client-side)
        const clientProgress = progressTracker.loadProgress();
        setProgress(clientProgress);

        // Optionally sync with server
        try {
          const response = await fetch('/api/progress');
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              // Merge server data with local data
              const merged = { ...clientProgress, ...result.data };
              setProgress(merged);
              progressTracker.saveProgress(merged);
            }
          }
        } catch (serverError) {
          // Server sync failed, but we have local data
          console.warn('Server sync failed, using local data:', serverError);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load progress';
        setError(errorMessage);
        console.error('Error loading progress:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, []);

  // Update progress locally and optionally sync with server
  const updateProgress = useCallback(async (updateData: ProgressUpdateData) => {
    if (!progress) return;

    try {
      // Handle vocabulary updates
      if (updateData.vocabulary) {
        const vocab = updateData.vocabulary;
        progressTracker.recordVocabularyPractice(
          vocab.word,
          vocab.definition,
          vocab.pronunciation_clear,
          vocab.meaning_understood,
          vocab.used_in_sentence,
          vocab.difficulty_rating
        );

        // Sync with server
        try {
          await fetch('/api/progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'vocabulary',
              data: vocab
            })
          });
        } catch (serverError) {
          console.warn('Failed to sync vocabulary progress with server:', serverError);
        }
      }

      // Handle pronunciation updates
      if (updateData.pronunciation) {
        const pron = updateData.pronunciation;
        progressTracker.recordPronunciationSession(
          pron.sounds_practiced,
          pron.duration_minutes,
          pron.improvement_notes,
          pron.confidence_rating
        );

        // Sync with server
        try {
          await fetch('/api/progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'pronunciation',
              data: pron
            })
          });
        } catch (serverError) {
          console.warn('Failed to sync pronunciation progress with server:', serverError);
        }
      }

      // Handle sound improvement updates
      if (updateData.sound_improved) {
        const soundData = updateData.sound_improved;
        progressTracker.markSoundImproved(soundData.sound);

        // Sync with server
        try {
          await fetch('/api/progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'sound_improved',
              data: soundData
            })
          });
        } catch (serverError) {
          console.warn('Failed to sync sound improvement with server:', serverError);
        }
      }

      // Reload progress from tracker to get updated state
      const newProgress = progressTracker.loadProgress();
      setProgress(newProgress);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update progress';
      setError(errorMessage);
      console.error('Error updating progress:', err);
      return { success: false, error: errorMessage };
    }
  }, [progress]);

  // Record vocabulary practice (simplified interface)
  const recordVocabularyPractice = useCallback((
    word: string,
    definition: string,
    pronunciationClear: boolean,
    meaningUnderstood: boolean,
    usedInSentence: boolean,
    difficultyRating: number = 3
  ) => {
    return updateProgress({
      vocabulary: {
        word,
        definition,
        pronunciation_clear: pronunciationClear,
        meaning_understood: meaningUnderstood,
        used_in_sentence: usedInSentence,
        difficulty_rating: difficultyRating
      }
    });
  }, [updateProgress]);

  // Record pronunciation session (simplified interface)
  const recordPronunciationSession = useCallback((
    soundsPracticed: string[],
    durationMinutes: number,
    improvementNotes: string,
    confidenceRating: number
  ) => {
    return updateProgress({
      pronunciation: {
        sounds_practiced: soundsPracticed,
        duration_minutes: durationMinutes,
        improvement_notes: improvementNotes,
        confidence_rating: confidenceRating
      }
    });
  }, [updateProgress]);

  // Mark sound as improved
  const markSoundImproved = useCallback((sound: string) => {
    return updateProgress({
      sound_improved: { sound }
    });
  }, [updateProgress]);

  // Get progress summary
  const getProgressSummary = useCallback(() => {
    if (!progress) return null;
    return progressTracker.getProgressSummary();
  }, [progress]);

  // Reset progress
  const resetProgress = useCallback(async () => {
    try {
      progressTracker.resetProgress();

      // Sync with server
      try {
        await fetch('/api/progress', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'reset'
          })
        });
      } catch (serverError) {
        console.warn('Failed to sync progress reset with server:', serverError);
      }

      const newProgress = progressTracker.loadProgress();
      setProgress(newProgress);
      setError(null);

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset progress';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  // Export progress
  const exportProgress = useCallback(() => {
    return progressTracker.exportProgress();
  }, []);

  // Import progress
  const importProgress = useCallback(async (jsonData: string) => {
    try {
      const success = progressTracker.importProgress(jsonData);

      if (success) {
        // Sync with server
        try {
          await fetch('/api/progress', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'import',
              data: JSON.parse(jsonData)
            })
          });
        } catch (serverError) {
          console.warn('Failed to sync progress import with server:', serverError);
        }

        const newProgress = progressTracker.loadProgress();
        setProgress(newProgress);
        setError(null);
      }

      return { success };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import progress';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  return {
    progress,
    loading,
    error,
    updateProgress,
    recordVocabularyPractice,
    recordPronunciationSession,
    markSoundImproved,
    getProgressSummary,
    resetProgress,
    exportProgress,
    importProgress,
  };
}