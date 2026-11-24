import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { containsPattern } from '../database/contains-pattern.js';
import { Contact } from './contact.entity.js';
import type { CreateContactDto, ListContactsQuery, UpdateContactDto } from './contacts.schemas.js';

/**
 * The current user's contacts (docs/design/v0.4-contacts.md). Every method takes the user's id and filters by it, so
 * an id from the URL can never reach another user's row; a contact that is not theirs is "not found".
 */
@Injectable()
export class ContactsService {
  constructor(@InjectRepository(Contact) private readonly contacts: Repository<Contact>) {}

  /** By name, ignoring case. */
  list(userId: string, { q }: ListContactsQuery): Promise<Contact[]> {
    const query = this.contacts
      .createQueryBuilder('contact')
      .where('contact.userId = :userId', { userId })
      .orderBy('LOWER(contact.name)', 'ASC')
      .addOrderBy('contact.createdAt', 'ASC');
    if (q) {
      query.andWhere('(contact.name ILIKE :pattern OR contact.company ILIKE :pattern)', {
        pattern: containsPattern(q),
      });
    }
    return query.getMany();
  }

  create(userId: string, dto: CreateContactDto): Promise<Contact> {
    return this.contacts.save(this.contacts.create({ ...dto, userId }));
  }

  async findOne(userId: string, id: string): Promise<Contact> {
    const contact = await this.contacts.findOneBy({ id, userId });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async update(userId: string, id: string, changes: UpdateContactDto): Promise<Contact> {
    const contact = await this.findOne(userId, id);
    Object.assign(contact, changes);
    return this.contacts.save(contact);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { affected } = await this.contacts.delete({ id, userId });
    if (!affected) {
      throw new NotFoundException('Contact not found');
    }
  }
}
