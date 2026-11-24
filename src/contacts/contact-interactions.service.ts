import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ContactInteraction } from './contact-interaction.entity.js';
import { Contact } from './contact.entity.js';
import type { CreateInteractionDto, UpdateInteractionDto } from './contact-interactions.schemas.js';

/**
 * The conversations with the user's contacts (decision 038). Every method checks first that the contact is the user's,
 * then reaches the conversation through it: an id from the URL is never trusted alone.
 */
@Injectable()
export class ContactInteractionsService {
  constructor(
    @InjectRepository(ContactInteraction) private readonly interactions: Repository<ContactInteraction>,
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
  ) {}

  /** Latest first. */
  async list(userId: string, contactId: string): Promise<ContactInteraction[]> {
    await this.assertOwnContact(userId, contactId);
    return this.interactions.find({ where: { contactId }, order: { occurredOn: 'DESC', createdAt: 'DESC' } });
  }

  async create(userId: string, contactId: string, dto: CreateInteractionDto): Promise<ContactInteraction> {
    await this.assertOwnContact(userId, contactId);
    return this.interactions.save(this.interactions.create({ ...dto, contactId }));
  }

  async update(
    userId: string,
    contactId: string,
    id: string,
    changes: UpdateInteractionDto,
  ): Promise<ContactInteraction> {
    const interaction = await this.findOne(userId, contactId, id);
    Object.assign(interaction, changes);
    return this.interactions.save(interaction);
  }

  async remove(userId: string, contactId: string, id: string): Promise<void> {
    await this.assertOwnContact(userId, contactId);
    const { affected } = await this.interactions.delete({ id, contactId });
    if (!affected) {
      throw new NotFoundException('Interaction not found');
    }
  }

  private async findOne(userId: string, contactId: string, id: string): Promise<ContactInteraction> {
    await this.assertOwnContact(userId, contactId);
    const interaction = await this.interactions.findOneBy({ id, contactId });
    if (!interaction) {
      throw new NotFoundException('Interaction not found');
    }
    return interaction;
  }

  private async assertOwnContact(userId: string, contactId: string): Promise<void> {
    if (!(await this.contacts.existsBy({ id: contactId, userId }))) {
      throw new NotFoundException('Contact not found');
    }
  }
}
