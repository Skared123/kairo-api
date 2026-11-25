import { z } from 'zod';
import { text } from '../jobs/jobs.schemas.js';
import type { LearningItem } from './learning-item.entity.js';
import { LEARNING_KINDS, LEARNING_STATUSES } from './learning.enums.js';

/** A skill as the user writes it (decision 040): compared ignoring case and spaces, see skillKey(). */
export const skillName = z.string().trim().min(1).max(50);

/** The fields a user writes (docs/design/v0.5-learning.md). */
const itemFields = {
  title: z.string().trim().min(1).max(300),
  kind: z.enum(LEARNING_KINDS),
  url: z.url({ protocol: /^https?$/ }).max(2000).nullable().optional(),
  notes: text(5_000),
  /** The skills it trains, by name; new ones are created. On an update, the whole set. */
  skills: z.array(skillName).max(20).optional(),
};

export const createLearningItemSchema = z.strictObject(itemFields);
export type CreateLearningItemDto = z.infer<typeof createLearningItemSchema>;

export const updateLearningItemSchema = z
  .strictObject(itemFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'send at least one field' });
export type UpdateLearningItemDto = z.infer<typeof updateLearningItemSchema>;

export const learningItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  kind: z.enum(LEARNING_KINDS),
  url: z.string().nullable(),
  status: z.enum(LEARNING_STATUSES),
  finishedAt: z.iso.datetime().nullable(),
  isFocus: z.boolean(),
  notes: z.string().nullable(),
  /** By name. */
  skills: z.array(z.object({ id: z.uuid(), name: z.string() })),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type LearningItemResponse = z.infer<typeof learningItemSchema>;

/** The response never carries the owner. `item.skillLinks` must be loaded with their skills. */
export function toLearningItemResponse(item: LearningItem): LearningItemResponse {
  return {
    id: item.id,
    title: item.title,
    kind: item.kind,
    url: item.url,
    status: item.status,
    finishedAt: item.finishedAt?.toISOString() ?? null,
    isFocus: item.isFocus,
    notes: item.notes,
    skills: (item.skillLinks ?? [])
      .flatMap(({ skill }) => (skill ? [{ id: skill.id, name: skill.name }] : []))
      .sort((a, b) => a.name.localeCompare(b.name)),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
