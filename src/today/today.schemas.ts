import { z } from 'zod';
import type { Contact } from '../contacts/contact.entity.js';
import { JOB_STATUSES } from '../jobs/job.enums.js';
import type { Job } from '../jobs/job.entity.js';
import { taskSchema } from '../tasks/tasks.schemas.js';

export const followUpSchema = z.object({
  job: z.object({ id: z.uuid(), company: z.string(), title: z.string(), status: z.enum(JOB_STATUSES) }),
  /** The day to follow up, YYYY-MM-DD. */
  on: z.iso.date(),
  note: z.string().nullable(),
});
export type FollowUpResponse = z.infer<typeof followUpSchema>;

export const contactFollowUpSchema = z.object({
  contact: z.object({ id: z.uuid(), name: z.string(), company: z.string().nullable() }),
  /** The day to write again, YYYY-MM-DD. */
  on: z.iso.date(),
  note: z.string().nullable(),
});
export type ContactFollowUpResponse = z.infer<typeof contactFollowUpSchema>;

/** Everything Today shows, not filtered by day: the browser sorts it into sections with its own date (decision 035). */
export const todaySchema = z.object({
  /** Open tasks, and those done in the last 48 hours. */
  tasks: z.array(taskSchema),
  /** The follow-ups of jobs in an open stage, soonest first. */
  followUps: z.array(followUpSchema),
  /** The contacts to write to again, soonest first (decision 037). */
  contactFollowUps: z.array(contactFollowUpSchema),
});
export type TodayResponse = z.infer<typeof todaySchema>;

/** `job.nextFollowUpOn` must be set. */
export function toFollowUpResponse(job: Job): FollowUpResponse {
  return {
    job: { id: job.id, company: job.company, title: job.title, status: job.status },
    on: job.nextFollowUpOn!,
    note: job.nextFollowUpNote,
  };
}

/** `contact.nextFollowUpOn` must be set. */
export function toContactFollowUpResponse(contact: Contact): ContactFollowUpResponse {
  return {
    contact: { id: contact.id, name: contact.name, company: contact.company },
    on: contact.nextFollowUpOn!,
    note: contact.nextFollowUpNote,
  };
}
