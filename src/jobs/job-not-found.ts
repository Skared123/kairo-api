import { BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/**
 * The answer when a request body names a job that is not one of the user's. A missing job and another user's job get
 * the same answer, so it reveals nothing.
 */
export function jobNotFound(): BadRequestException {
  return new BadRequestException({ statusCode: 400, error: 'job_not_found', message: 'Job not found' });
}

/** PostgreSQL's foreign_key_violation: a row was linked to one deleted since it was checked. */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23503';
}
