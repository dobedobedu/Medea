import { rulesCoach } from './rulesCoach';
import { socialCoach } from './socialCoach';
import { practicePartner } from './practicePartner';
import { emotionGuide } from './emotionGuide';

// Configure handoffs between all social skills agents
rulesCoach.handoffs = [socialCoach, practicePartner, emotionGuide];
socialCoach.handoffs = [rulesCoach, practicePartner, emotionGuide];
practicePartner.handoffs = [rulesCoach, socialCoach, emotionGuide];
emotionGuide.handoffs = [rulesCoach, socialCoach, practicePartner];

// Social skills scenario with all four agents
export const socialSkillsScenario = [
  rulesCoach,
  socialCoach,
  practicePartner,
  emotionGuide,
];