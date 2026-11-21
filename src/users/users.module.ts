import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountPolicy } from './account.policy.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { User } from './user.entity.js';

/** Accounts, as the admin manages them (decision 017). */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AccountsController],
  providers: [AccountsService, AccountPolicy],
})
export class UsersModule {}
