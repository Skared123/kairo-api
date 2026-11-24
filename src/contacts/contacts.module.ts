import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/job.entity.js';
import { Contact } from './contact.entity.js';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';
import { JobContact } from './job-contact.entity.js';

/** v0.4 Contacts: the people the user talks to (docs/design/v0.4-contacts.md). */
@Module({
  imports: [TypeOrmModule.forFeature([Contact, JobContact, Job])],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
