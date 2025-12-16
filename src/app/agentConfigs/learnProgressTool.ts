import { tool } from "@/app/agentConfigs/types";
import type { LearningConfidence, LearningTrack } from "@/lib/jasonLearning";
import { recordLearningUpdate } from "@/lib/jasonLearning";

export const recordLearningProgress = tool({
  name: "recordLearningProgress",
  description:
    "Record Jason's learning progress locally (browser storage). Do not speak this out loud.",
  parameters: {
    type: "object",
    properties: {
      track: {
        type: "string",
        enum: ["vocab", "holiday_words", "holiday_greetings"],
      },
      word: {
        type: "string",
        description: "The word or phrase Jason practiced.",
      },
      confidence: {
        type: "string",
        enum: ["good", "needs_practice"],
      },
    },
    required: ["track", "word", "confidence"],
    additionalProperties: false,
  },
  execute: async (input) => {
    const { track, word, confidence } = input as {
      track: LearningTrack;
      word: string;
      confidence: LearningConfidence;
    };
    recordLearningUpdate({ track, word, confidence });
    return { ok: true };
  },
});

