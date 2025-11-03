import { learnScenario } from './learn';
import { chatSupervisorScenario } from './chatSupervisor';
import { socialSkillsScenario } from './socialSkills';
import { dailyReflectionScenario } from './dailyReflection';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  learn: learnScenario,
  chatSupervisor: chatSupervisorScenario,
  socialSkills: socialSkillsScenario,
  dailyReflection: dailyReflectionScenario,
};

export const defaultAgentSetKey = 'dailyReflection';
