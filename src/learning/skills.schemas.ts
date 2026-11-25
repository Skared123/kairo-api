import { z } from 'zod';
import { skillName } from './learning.schemas.js';
import type { Skill } from './skill.entity.js';

export const renameSkillSchema = z.strictObject({ name: skillName });
export type RenameSkillDto = z.infer<typeof renameSkillSchema>;

export const skillSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** How many of the user's learning items train it. */
  itemCount: z.int(),
});
export type SkillResponse = z.infer<typeof skillSchema>;

export function toSkillResponse(skill: Skill, itemCount: number): SkillResponse {
  return { id: skill.id, name: skill.name, itemCount };
}
