import { QueryFailedError } from 'typeorm';

/** The PostgreSQL error code of a failed query, if it is one. */
function postgresCode(error: unknown): string | undefined {
  return error instanceof QueryFailedError ? (error.driverError as { code?: string }).code : undefined;
}

/** foreign_key_violation: a row was linked to one deleted since it was checked. */
export function isForeignKeyViolation(error: unknown): boolean {
  return postgresCode(error) === '23503';
}

/** unique_violation: a value a unique index already holds. */
export function isUniqueViolation(error: unknown): boolean {
  return postgresCode(error) === '23505';
}
