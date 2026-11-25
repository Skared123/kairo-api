import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Contact } from '../contacts/contact.entity.js';
import { OPEN_STATUSES } from '../jobs/job.enums.js';
import { Job } from '../jobs/job.entity.js';
import { LearningItem } from '../learning/learning-item.entity.js';
import { Task } from '../tasks/task.entity.js';

/**
 * Done tasks stay in Today's answer this long: a "done today" in any time zone began less than 24 hours ago, so 48
 * leaves room for every one of them (decision 035).
 */
const RECENTLY_DONE = '48 hours';

/**
 * What Today shows (docs/design/v0.3-today.md, v0.4-contacts.md, v0.5-learning.md). Every query filters by the user,
 * like every other one.
 */
@Injectable()
export class TodayService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(LearningItem) private readonly learning: Repository<LearningItem>,
  ) {}

  /** Open tasks by due day (those without one last), then the recently done ones. */
  tasksFor(userId: string): Promise<Task[]> {
    return this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.job', 'job')
      .where('task.userId = :userId', { userId })
      .andWhere(`(task.doneAt IS NULL OR task.doneAt > now() - interval '${RECENTLY_DONE}')`)
      .orderBy('task.doneAt IS NOT NULL', 'ASC')
      .addOrderBy('task.dueOn', 'ASC', 'NULLS LAST')
      .addOrderBy('task.createdAt', 'ASC')
      .getMany();
  }

  /** The jobs in an open stage that have a follow-up, soonest first. */
  followUpsFor(userId: string): Promise<Job[]> {
    return this.jobs
      .createQueryBuilder('job')
      .where('job.userId = :userId', { userId })
      .andWhere('job.nextFollowUpOn IS NOT NULL')
      .andWhere('job.status IN (:...open)', { open: OPEN_STATUSES })
      .orderBy('job.nextFollowUpOn', 'ASC')
      .addOrderBy('job.company', 'ASC')
      .getMany();
  }

  /** The contacts with a next follow-up, soonest first (decision 037). */
  contactFollowUpsFor(userId: string): Promise<Contact[]> {
    return this.contacts
      .createQueryBuilder('contact')
      .where('contact.userId = :userId', { userId })
      .andWhere('contact.nextFollowUpOn IS NOT NULL')
      .orderBy('contact.nextFollowUpOn', 'ASC')
      .addOrderBy('LOWER(contact.name)', 'ASC')
      .getMany();
  }

  /** The study item the user marked as focus, with its skills, or null (decision 042). */
  focusFor(userId: string): Promise<LearningItem | null> {
    return this.learning
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.skillLinks', 'link')
      .leftJoinAndSelect('link.skill', 'skill', 'skill.userId = item.userId')
      .where('item.userId = :userId', { userId })
      .andWhere('item.isFocus')
      .getOne();
  }
}
