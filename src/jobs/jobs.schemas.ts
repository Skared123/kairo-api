import { z } from 'zod';
import { CONTRACT_TYPES, JOB_SOURCES, JOB_STATUSES, SALARY_PERIODS, WORK_MODES } from './job.enums.js';
import type { Job } from './job.entity.js';

/** Optional free text: trimmed, and an empty string clears it (forms send "" for an empty field). */
function text(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();
}

const salaryAmount = z.int().min(0).max(100_000_000).nullable().optional();

/** The fields a user writes. Status moves through its own endpoint (step 2), so updates leave it out. */
const jobFields = {
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  url: z.url({ protocol: /^https?$/ }).max(2000).nullable().optional(),
  source: z.enum(JOB_SOURCES).nullable().optional(),
  workMode: z.enum(WORK_MODES).nullable().optional(),
  location: text(200),
  timeZoneNotes: text(500),
  contractType: z.enum(CONTRACT_TYPES).nullable().optional(),
  salaryMin: salaryAmount,
  salaryMax: salaryAmount,
  salaryCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'must be an ISO 4217 code such as MXN or USD')
    .nullable()
    .optional(),
  salaryPeriod: z.enum(SALARY_PERIODS).nullable().optional(),
  description: text(20_000),
  notes: text(5_000),
};

export const createJobSchema = z.strictObject({ ...jobFields, status: z.enum(JOB_STATUSES).optional() });
export type CreateJobDto = z.infer<typeof createJobSchema>;

export const updateJobSchema = z
  .strictObject(jobFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'send at least one field' });
export type UpdateJobDto = z.infer<typeof updateJobSchema>;

export const listJobsQuerySchema = z.strictObject({
  status: z.enum(JOB_STATUSES).optional(),
  /** Matches company or title, ignoring case. */
  q: z.string().trim().max(200).optional(),
});
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;

export const jobSchema = z.object({
  id: z.uuid(),
  company: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  source: z.enum(JOB_SOURCES).nullable(),
  workMode: z.enum(WORK_MODES).nullable(),
  location: z.string().nullable(),
  timeZoneNotes: z.string().nullable(),
  contractType: z.enum(CONTRACT_TYPES).nullable(),
  salaryMin: z.int().nullable(),
  salaryMax: z.int().nullable(),
  salaryCurrency: z.string().nullable(),
  salaryPeriod: z.enum(SALARY_PERIODS).nullable(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(JOB_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type JobResponse = z.infer<typeof jobSchema>;

/** The response never carries the owner: every job a user sees is theirs. */
export function toJobResponse(job: Job): JobResponse {
  return {
    id: job.id,
    company: job.company,
    title: job.title,
    url: job.url,
    source: job.source,
    workMode: job.workMode,
    location: job.location,
    timeZoneNotes: job.timeZoneNotes,
    contractType: job.contractType,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    salaryPeriod: job.salaryPeriod,
    description: job.description,
    notes: job.notes,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
