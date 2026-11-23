import type { DataSourceOptions } from 'typeorm';
import { Session } from '../auth/session.entity.js';
import { Job } from '../jobs/job.entity.js';
import { User } from '../users/user.entity.js';

/**
 * Every entity, registered explicitly. The app and the TypeORM CLI read this same list,
 * so a new entity only has to be added here.
 */
export const entities: NonNullable<DataSourceOptions['entities']> = [User, Session, Job];
