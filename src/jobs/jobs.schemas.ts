import { z } from 'zod';
import { CONTRACT_TYPES, JOB_SOURCES, JOB_STATUSES, SALARY_PERIODS, WORK_MODES } from './job.enums.js';
import { matchCriteria, type CriteriaForMatch } from './criteria-match.js';
import type { JobStageChange } from './job-stage-change.entity.js';
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

/** The fields a user writes. Status moves through POST /jobs/:id/status (decision 028), so updates leave it out. */
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
  /** A calendar day, YYYY-MM-DD. */
  nextFollowUpOn: z.iso.date().nullable().optional(),
  nextFollowUpNote: text(500),
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
  /** `updated`: last changed first. `followUp`: soonest follow-up first, jobs without one last. */
  sort: z.enum(['updated', 'followUp']).default('updated'),
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
  nextFollowUpOn: z.iso.date().nullable(),
  nextFollowUpNote: z.string().nullable(),
  /** How the job compares with the user's criteria; null where the user set no such criterion (decision 029). */
  criteria: z.object({
    salary: z.enum(['meets', 'misses', 'unknown', 'not_comparable']).nullable(),
    remote: z.enum(['meets', 'misses', 'unknown']).nullable(),
    contract: z.enum(['meets', 'misses', 'unknown']).nullable(),
  }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type JobResponse = z.infer<typeof jobSchema>;

/** The response never carries the owner: every job a user sees is theirs. */
export function toJobResponse(job: Job, criteria: CriteriaForMatch): JobResponse {
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
    nextFollowUpOn: job.nextFollowUpOn,
    nextFollowUpNote: job.nextFollowUpNote,
    criteria: matchCriteria(job, criteria) as JobResponse['criteria'],
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

/** A job that may be the same posting as one just saved (decision 031): enough to recognize it and open it. */
export const possibleDuplicateSchema = z.object({
  id: z.uuid(),
  company: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  status: z.enum(JOB_STATUSES),
});
export type PossibleDuplicate = z.infer<typeof possibleDuplicateSchema>;

/** What POST /jobs answers: the new job, and the user's jobs that may be the same posting. It warns, never blocks. */
export const createdJobSchema = jobSchema.extend({ possibleDuplicates: z.array(possibleDuplicateSchema) });
export type CreatedJobResponse = z.infer<typeof createdJobSchema>;

export function toPossibleDuplicate({ id, company, title, url, status }: Job): PossibleDuplicate {
  return { id, company, title, url, status };
}

export const changeStatusSchema = z.strictObject({ status: z.enum(JOB_STATUSES) });
export type ChangeStatusDto = z.infer<typeof changeStatusSchema>;

export const stageChangeSchema = z.object({
  /** Null for the first entry, when the job was created. */
  fromStatus: z.enum(JOB_STATUSES).nullable(),
  toStatus: z.enum(JOB_STATUSES),
  changedAt: z.iso.datetime(),
});
export type StageChangeResponse = z.infer<typeof stageChangeSchema>;

export function toStageChangeResponse({ fromStatus, toStatus, changedAt }: JobStageChange): StageChangeResponse {
  return { fromStatus, toStatus, changedAt: changedAt.toISOString() };
}

export const criteriaSchema = z.object({
  minSalary: z.int().nullable(),
  currency: z.string().nullable(),
  period: z.enum(SALARY_PERIODS).nullable(),
  remoteOnly: z.boolean(),
  /** Empty means any contract type. */
  contractTypes: z.array(z.enum(CONTRACT_TYPES)),
});
export type CriteriaResponse = z.infer<typeof criteriaSchema>;

/** The whole set of criteria, replaced on every save. A target salary needs its currency and period. */
export const saveCriteriaSchema = z
  .strictObject({
    minSalary: z.int().min(0).max(100_000_000).nullable(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'must be an ISO 4217 code such as MXN or USD')
      .nullable(),
    period: z.enum(SALARY_PERIODS).nullable(),
    remoteOnly: z.boolean(),
    contractTypes: z
      .array(z.enum(CONTRACT_TYPES))
      .refine((types) => new Set(types).size === types.length, 'must not repeat a contract type'),
  })
  .refine(
    ({ minSalary, currency, period }) =>
      [minSalary, currency, period].every((v) => v === null) || [minSalary, currency, period].every((v) => v !== null),
    { message: 'set minSalary, currency and period together, or none of them', path: ['minSalary'] },
  );
export type SaveCriteriaDto = z.infer<typeof saveCriteriaSchema>;

export function toCriteriaResponse(criteria: CriteriaForMatch): CriteriaResponse {
  const { minSalary, currency, period, remoteOnly, contractTypes } = criteria;
  return { minSalary, currency, period, remoteOnly, contractTypes: [...contractTypes] };
}
