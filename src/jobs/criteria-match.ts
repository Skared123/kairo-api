import type { ContractType, SalaryPeriod, WorkMode } from './job.enums.js';

/**
 * How a job compares with one criterion:
 * - `meets` / `misses`: the job says enough to tell;
 * - `unknown`: the job does not say (no salary, no work mode, no contract type);
 * - `not_comparable`: salary only, in another currency or period (decision 029: no conversion);
 * - `null`: the user set no such criterion, so there is nothing to compare.
 */
export type MatchResult = 'meets' | 'misses' | 'unknown' | 'not_comparable' | null;

export type CriteriaMatch = { salary: MatchResult; remote: MatchResult; contract: MatchResult };

/** The job fields the comparison reads. */
export type JobForMatch = {
  workMode: WorkMode | null;
  contractType: ContractType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
};

/** The criteria the comparison reads; every field optional, as before the user saves any. */
export type CriteriaForMatch = {
  minSalary: number | null;
  currency: string | null;
  period: SalaryPeriod | null;
  remoteOnly: boolean;
  contractTypes: readonly ContractType[];
};

export const NO_CRITERIA: CriteriaForMatch = {
  minSalary: null,
  currency: null,
  period: null,
  remoteOnly: false,
  contractTypes: [],
};

/** Compares a job with the user's criteria. Pure: no database, no clock. */
export function matchCriteria(job: JobForMatch, criteria: CriteriaForMatch): CriteriaMatch {
  return {
    salary: matchSalary(job, criteria),
    remote: criteria.remoteOnly ? (job.workMode === null ? 'unknown' : verdict(job.workMode === 'remote')) : null,
    contract:
      criteria.contractTypes.length > 0
        ? job.contractType === null
          ? 'unknown'
          : verdict(criteria.contractTypes.includes(job.contractType))
        : null,
  };
}

/** The job meets the target when the top of its range reaches it, in the same currency and period. */
function matchSalary(job: JobForMatch, { minSalary, currency, period }: CriteriaForMatch): MatchResult {
  if (minSalary === null || currency === null || period === null) {
    return null;
  }
  const top = job.salaryMax ?? job.salaryMin;
  if (top === null) {
    return 'unknown';
  }
  if (job.salaryCurrency !== currency || job.salaryPeriod !== period) {
    return 'not_comparable';
  }
  return verdict(top >= minSalary);
}

const verdict = (meets: boolean): MatchResult => (meets ? 'meets' : 'misses');
