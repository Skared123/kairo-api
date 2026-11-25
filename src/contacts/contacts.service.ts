import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type Repository } from 'typeorm';
import { containsPattern } from '../database/contains-pattern.js';
import { isForeignKeyViolation } from '../database/postgres-errors.js';
import { jobNotFound } from '../jobs/job-not-found.js';
import { Job } from '../jobs/job.entity.js';
import { Contact } from './contact.entity.js';
import type { CreateContactDto, ListContactsQuery, UpdateContactDto } from './contacts.schemas.js';
import { JobContact } from './job-contact.entity.js';

/**
 * The current user's contacts (docs/design/v0.4-contacts.md). Every method takes the user's id and filters by it, so
 * an id from the URL can never reach another user's row; a contact that is not theirs is "not found". Both ends of a
 * link to a job are always the user's (decision 036).
 */
@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(JobContact) private readonly links: Repository<JobContact>,
    private readonly dataSource: DataSource,
  ) {}

  /** By name, ignoring case, each with its jobs. */
  list(userId: string, { q, jobId }: ListContactsQuery): Promise<Contact[]> {
    const query = this.withJobs(userId)
      .orderBy('LOWER(contact.name)', 'ASC')
      .addOrderBy('contact.createdAt', 'ASC')
      .addOrderBy('link.createdAt', 'ASC');
    if (q) {
      query.andWhere('(contact.name ILIKE :pattern OR contact.company ILIKE :pattern)', {
        pattern: containsPattern(q),
      });
    }
    if (jobId) {
      // A subquery, not the join: the contacts found still show all their jobs.
      query.andWhere(
        'EXISTS (SELECT 1 FROM job_contacts jc WHERE jc.contact_id = contact.id AND jc.job_id = :jobId)',
        { jobId },
      );
    }
    return query.getMany();
  }

  /** Creates the contact and its links together; any job that is not the user's stops both. */
  async create(userId: string, { jobIds = [], ...fields }: CreateContactDto): Promise<Contact> {
    const ids = [...new Set(jobIds)];
    if (ids.length > 0 && (await this.jobs.countBy({ id: In(ids), userId })) !== ids.length) {
      throw jobNotFound();
    }
    try {
      const { id } = await this.dataSource.transaction(async (manager) => {
        const contact = await manager.save(this.contacts.create({ ...fields, userId }));
        if (ids.length > 0) {
          await manager.insert(
            JobContact,
            ids.map((jobId) => ({ jobId, contactId: contact.id })),
          );
        }
        return contact;
      });
      return this.findOne(userId, id);
    } catch (error) {
      // A job deleted since it was checked.
      throw isForeignKeyViolation(error) ? jobNotFound() : error;
    }
  }

  async findOne(userId: string, id: string): Promise<Contact> {
    const contact = await this.withJobs(userId)
      .andWhere('contact.id = :id', { id })
      .orderBy('link.createdAt', 'ASC')
      .getOne();
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async update(userId: string, id: string, changes: UpdateContactDto): Promise<Contact> {
    const contact = await this.findOwn(userId, id);
    Object.assign(contact, changes);
    await this.contacts.save(contact);
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { affected } = await this.contacts.delete({ id, userId });
    if (!affected) {
      throw new NotFoundException('Contact not found');
    }
  }

  /** Links the contact to the job. Linking twice changes nothing. */
  async link(userId: string, id: string, jobId: string): Promise<void> {
    await this.assertOwnEnds(userId, id, jobId);
    try {
      await this.links.createQueryBuilder().insert().values({ jobId, contactId: id }).orIgnore().execute();
    } catch (error) {
      // Either end deleted since it was checked.
      throw isForeignKeyViolation(error) ? new NotFoundException('Job not found') : error;
    }
  }

  async unlink(userId: string, id: string, jobId: string): Promise<void> {
    await this.assertOwnEnds(userId, id, jobId);
    await this.links.delete({ jobId, contactId: id });
  }

  /**
   * The user's contacts with their jobs. The join repeats the owner check, so a link could never show another user's
   * job even if one existed.
   */
  private withJobs(userId: string) {
    return this.contacts
      .createQueryBuilder('contact')
      .leftJoinAndSelect('contact.jobLinks', 'link')
      .leftJoinAndSelect('link.job', 'job', 'job.userId = contact.userId')
      .where('contact.userId = :userId', { userId });
  }

  private async findOwn(userId: string, id: string): Promise<Contact> {
    const contact = await this.contacts.findOneBy({ id, userId });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  /** Both ends of a link in the URL: either one that is missing or not the user's is "not found". */
  private async assertOwnEnds(userId: string, id: string, jobId: string): Promise<void> {
    await this.findOwn(userId, id);
    if (!(await this.jobs.existsBy({ id: jobId, userId }))) {
      throw new NotFoundException('Job not found');
    }
  }
}
