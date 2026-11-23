/** The stages a job moves through (decision 028). */
export const JOB_STATUSES = [
  'to_review',
  'to_apply',
  'applied',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'discarded',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_SOURCES = ['linkedin', 'referral', 'company_site', 'job_board', 'recruiter', 'other'] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const CONTRACT_TYPES = ['employee', 'contractor'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

/** Salary periods (decision 029). */
export const SALARY_PERIODS = ['month', 'year'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];
