import { z } from 'zod';
import { text } from '../jobs/jobs.schemas.js';
import type { ContactInteraction } from './contact-interaction.entity.js';
import { INTERACTION_CHANNELS } from './contact.enums.js';

/** The fields a user writes (decision 038). */
const interactionFields = {
  /** A calendar day, YYYY-MM-DD. */
  occurredOn: z.iso.date(),
  channel: z.enum(INTERACTION_CHANNELS),
  note: text(2_000),
};

export const createInteractionSchema = z.strictObject(interactionFields);
export type CreateInteractionDto = z.infer<typeof createInteractionSchema>;

export const updateInteractionSchema = z
  .strictObject(interactionFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'send at least one field' });
export type UpdateInteractionDto = z.infer<typeof updateInteractionSchema>;

export const interactionSchema = z.object({
  id: z.uuid(),
  occurredOn: z.iso.date(),
  channel: z.enum(INTERACTION_CHANNELS),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type InteractionResponse = z.infer<typeof interactionSchema>;

export function toInteractionResponse(interaction: ContactInteraction): InteractionResponse {
  return {
    id: interaction.id,
    occurredOn: interaction.occurredOn,
    channel: interaction.channel,
    note: interaction.note,
    createdAt: interaction.createdAt.toISOString(),
  };
}
