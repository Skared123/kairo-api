import { z } from 'zod';
import { text } from '../jobs/jobs.schemas.js';
import { CONTACT_KINDS } from './contact.enums.js';
import type { Contact } from './contact.entity.js';

/** The fields a user writes (docs/design/v0.4-contacts.md). */
const contactFields = {
  name: z.string().trim().min(1).max(200),
  company: text(200),
  role: text(200),
  kind: z.enum(CONTACT_KINDS).nullable().optional(),
  email: z.email().max(320).nullable().optional(),
  phone: text(50),
  /** Typed by hand and never fetched (CLAUDE.md, hard rules). */
  linkedinUrl: z.url({ protocol: /^https?$/ }).max(2000).nullable().optional(),
  notes: text(5_000),
  /** When to write again, a calendar day: YYYY-MM-DD (decision 037). */
  nextFollowUpOn: z.iso.date().nullable().optional(),
  nextFollowUpNote: text(500),
};

export const createContactSchema = z.strictObject(contactFields);
export type CreateContactDto = z.infer<typeof createContactSchema>;

export const updateContactSchema = z
  .strictObject(contactFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'send at least one field' });
export type UpdateContactDto = z.infer<typeof updateContactSchema>;

export const listContactsQuerySchema = z.strictObject({
  /** Matches name or company, ignoring case. */
  q: z.string().trim().max(200).optional(),
});
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;

export const contactSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  company: z.string().nullable(),
  role: z.string().nullable(),
  kind: z.enum(CONTACT_KINDS).nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  notes: z.string().nullable(),
  nextFollowUpOn: z.iso.date().nullable(),
  nextFollowUpNote: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ContactResponse = z.infer<typeof contactSchema>;

/** The response never carries the owner: every contact a user sees is theirs. */
export function toContactResponse(contact: Contact): ContactResponse {
  return {
    id: contact.id,
    name: contact.name,
    company: contact.company,
    role: contact.role,
    kind: contact.kind,
    email: contact.email,
    phone: contact.phone,
    linkedinUrl: contact.linkedinUrl,
    notes: contact.notes,
    nextFollowUpOn: contact.nextFollowUpOn,
    nextFollowUpNote: contact.nextFollowUpNote,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}
