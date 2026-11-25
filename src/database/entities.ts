import type { DataSourceOptions } from 'typeorm';
import { Session } from '../auth/session.entity.js';
import { ContactInteraction } from '../contacts/contact-interaction.entity.js';
import { Contact } from '../contacts/contact.entity.js';
import { JobContact } from '../contacts/job-contact.entity.js';
import { JobCriteria } from '../jobs/job-criteria.entity.js';
import { JobStageChange } from '../jobs/job-stage-change.entity.js';
import { Job } from '../jobs/job.entity.js';
import { LearningItemSkill } from '../learning/learning-item-skill.entity.js';
import { LearningItem } from '../learning/learning-item.entity.js';
import { Skill } from '../learning/skill.entity.js';
import { Task } from '../tasks/task.entity.js';
import { User } from '../users/user.entity.js';

/**
 * Every entity, registered explicitly. The app and the TypeORM CLI read this same list,
 * so a new entity only has to be added here.
 */
export const entities: NonNullable<DataSourceOptions['entities']> = [
  User,
  Session,
  Job,
  JobStageChange,
  JobCriteria,
  Task,
  Contact,
  JobContact,
  ContactInteraction,
  Skill,
  LearningItem,
  LearningItemSkill,
];
