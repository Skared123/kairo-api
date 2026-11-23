/**
 * Duplicate detection (decision 031). TODO(Raymundo): write these tests along with
 * JobsService.findPossibleDuplicates(). Use test/jobs.e2e-spec.ts as a model: createTestApp(), createTwoUsers(), and
 * POST /jobs, whose answer carries `possibleDuplicates`.
 */
describe('Job duplicates (e2e)', () => {
  it.todo('finds nothing for the first job');
  it.todo('finds a job with the same URL');
  it.todo('finds a job whose company and title are written differently but are the same posting');
  it.todo('does not flag a different role at the same company');
  it.todo('does not list the new job among its own duplicates');
  it.todo('returns the closest matches first, and only a few');
  it.todo('still creates the job: a duplicate warns, never blocks');
  it.todo("never lists another user's jobs (createTwoUsers)");
});
