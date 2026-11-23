import { matchCriteria, NO_CRITERIA, type CriteriaForMatch, type JobForMatch } from './criteria-match.js';

const job: JobForMatch = {
  workMode: 'remote',
  contractType: 'contractor',
  salaryMin: 4000,
  salaryMax: 6000,
  salaryCurrency: 'USD',
  salaryPeriod: 'month',
};

const criteria: CriteriaForMatch = {
  minSalary: 5000,
  currency: 'USD',
  period: 'month',
  remoteOnly: true,
  contractTypes: ['contractor'],
};

describe('matchCriteria', () => {
  it('compares nothing when the user set no criteria', () => {
    expect(matchCriteria(job, NO_CRITERIA)).toEqual({ salary: null, remote: null, contract: null });
  });

  it('meets every criterion the job satisfies', () => {
    expect(matchCriteria(job, criteria)).toEqual({ salary: 'meets', remote: 'meets', contract: 'meets' });
  });

  describe('salary', () => {
    it('meets the target when the top of the range reaches it', () => {
      expect(matchCriteria({ ...job, salaryMax: 5000 }, criteria).salary).toBe('meets');
      expect(matchCriteria({ ...job, salaryMax: 4999 }, criteria).salary).toBe('misses');
    });

    it('uses the minimum when the posting gives only one number', () => {
      expect(matchCriteria({ ...job, salaryMin: 5500, salaryMax: null }, criteria).salary).toBe('meets');
      expect(matchCriteria({ ...job, salaryMin: 3000, salaryMax: null }, criteria).salary).toBe('misses');
    });

    it('is unknown when the posting gives no salary', () => {
      const noSalary = { ...job, salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null };
      expect(matchCriteria(noSalary, criteria).salary).toBe('unknown');
    });

    it('is not comparable in another currency or period, never converted (decision 029)', () => {
      expect(matchCriteria({ ...job, salaryCurrency: 'MXN', salaryMax: 900_000 }, criteria).salary).toBe(
        'not_comparable',
      );
      expect(matchCriteria({ ...job, salaryPeriod: 'year', salaryMax: 80_000 }, criteria).salary).toBe(
        'not_comparable',
      );
    });
  });

  describe('remote', () => {
    it('meets only a remote job when the user wants remote only', () => {
      expect(matchCriteria({ ...job, workMode: 'hybrid' }, criteria).remote).toBe('misses');
      expect(matchCriteria({ ...job, workMode: 'onsite' }, criteria).remote).toBe('misses');
      expect(matchCriteria({ ...job, workMode: null }, criteria).remote).toBe('unknown');
    });

    it('compares nothing when the user accepts any work mode', () => {
      expect(matchCriteria({ ...job, workMode: 'onsite' }, { ...criteria, remoteOnly: false }).remote).toBeNull();
    });
  });

  describe('contract', () => {
    it('meets the contract types the user accepts', () => {
      expect(matchCriteria({ ...job, contractType: 'employee' }, criteria).contract).toBe('misses');
      expect(
        matchCriteria({ ...job, contractType: 'employee' }, { ...criteria, contractTypes: ['employee', 'contractor'] })
          .contract,
      ).toBe('meets');
      expect(matchCriteria({ ...job, contractType: null }, criteria).contract).toBe('unknown');
    });

    it('compares nothing when the user accepts any contract', () => {
      expect(matchCriteria(job, { ...criteria, contractTypes: [] }).contract).toBeNull();
    });
  });
});
