import { rulesCoach } from './rulesCoach';
import { socialCoach } from './socialCoach';
import { practicePartner } from './practicePartner';
import { emotionGuide } from './emotionGuide';

// Scenario: expose specific situations in the left panel (no automatic handoffs)
rulesCoach.handoffs = [];
socialCoach.handoffs = [];
practicePartner.handoffs = [];
emotionGuide.handoffs = [];

// Social skills scenario with all four agents
export const socialSkillsScenario = [
  rulesCoach,
  socialCoach,
  practicePartner,
  emotionGuide,
];
