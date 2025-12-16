export type LearningTrack = "vocab" | "holiday_words" | "holiday_greetings";
export type LearningConfidence = "good" | "needs_practice";

export interface LearningUpdate {
  track: LearningTrack;
  word: string;
  confidence: LearningConfidence;
  atMs: number;
}

export interface LearningProgress {
  version: 1;
  updates: LearningUpdate[];
  masteredByTrack: Record<LearningTrack, string[]>;
}

const STORAGE_KEY = "medea:learningProgress:v1";
const MAX_UPDATES = 400;
export const LEARNING_PROGRESS_UPDATED_EVENT = "medea:learningProgressUpdated";

const DEFAULT_PROGRESS: LearningProgress = {
  version: 1,
  updates: [],
  masteredByTrack: {
    vocab: [],
    holiday_words: [],
    holiday_greetings: [],
  },
};

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function loadLearningProgress(): LearningProgress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PROGRESS;

  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== "object") return DEFAULT_PROGRESS;

  const version = (parsed as any).version;
  if (version !== 1) return DEFAULT_PROGRESS;

  const updates = Array.isArray((parsed as any).updates)
    ? ((parsed as any).updates as any[])
        .filter((u) => u && typeof u.word === "string")
        .slice(-MAX_UPDATES)
    : [];

  const masteredByTrack = (parsed as any).masteredByTrack;
  const vocab = Array.isArray(masteredByTrack?.vocab)
    ? masteredByTrack.vocab.filter((w: any) => typeof w === "string")
    : [];
  const holiday_words = Array.isArray(masteredByTrack?.holiday_words)
    ? masteredByTrack.holiday_words.filter((w: any) => typeof w === "string")
    : [];
  const holiday_greetings = Array.isArray(masteredByTrack?.holiday_greetings)
    ? masteredByTrack.holiday_greetings.filter((w: any) => typeof w === "string")
    : [];

  return {
    version: 1,
    updates: updates as LearningUpdate[],
    masteredByTrack: {
      vocab,
      holiday_words,
      holiday_greetings,
    },
  };
}

export function saveLearningProgress(progress: LearningProgress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function recordLearningUpdate(update: Omit<LearningUpdate, "atMs">) {
  if (typeof window === "undefined") return;
  const normalizedWord = update.word.trim().toLowerCase();
  if (!normalizedWord) return;

  const progress = loadLearningProgress();
  const entry: LearningUpdate = {
    ...update,
    word: normalizedWord,
    atMs: Date.now(),
  };

  progress.updates = [...progress.updates, entry].slice(-MAX_UPDATES);

  if (entry.confidence === "good") {
    const list = progress.masteredByTrack[entry.track] ?? [];
    if (!list.includes(normalizedWord)) {
      progress.masteredByTrack[entry.track] = [...list, normalizedWord];
    }
  }

  saveLearningProgress(progress);

  try {
    window.dispatchEvent(new CustomEvent(LEARNING_PROGRESS_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

export function tryRecordLearningUpdateFromText(text: string) {
  if (!text.includes("HANDOFF") || !text.includes("learning_update")) return;

  const match = text.match(/HANDOFF\s+\S+\s+(\{[\s\S]*\})\s*$/);
  if (!match?.[1]) return;

  const parsed = safeParseJson(match[1]);
  const learning = parsed?.learning_update;
  const track = learning?.track;
  const word = learning?.word;
  const confidence = learning?.confidence;

  const isTrack =
    track === "vocab" || track === "holiday_words" || track === "holiday_greetings";
  const isConfidence = confidence === "good" || confidence === "needs_practice";
  if (!isTrack || typeof word !== "string" || !isConfidence) return;
  recordLearningUpdate({ track, word, confidence });
}
