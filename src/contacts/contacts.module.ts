import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './contact.entity.js';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';

/** v0.4 Contacts: the people the user talks to (docs/design/v0.4-contacts.md). */
@Module({
  imports: [TypeOrmModule.forFeature([Contact])],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
