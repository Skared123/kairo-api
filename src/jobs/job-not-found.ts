import { BadRequestException } from '@nestjs/common';

/**
 * The answer when a request body names a job that is not one of the user's. A missing job and another user's job get
 * the same answer, so it reveals nothing.
 */
export function jobNotFound(): BadRequestException {
  return new BadRequestException({ statusCode: 400, error: 'job_not_found', message: 'Job not found' });
}
