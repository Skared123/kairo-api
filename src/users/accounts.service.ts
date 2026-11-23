import { PasswordHasher, SessionService } from '@nestjs/authentication';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, QueryFailedError, type Repository } from 'typeorm';
import type { CreateAccountDto, UpdateAccountDto } from './accounts.schemas.js';
import { generateTemporaryPassword, temporaryPasswordExpiry } from './temporary-password.js';
import { User, type UserRole } from './user.entity.js';

/** Key of the advisory lock that serializes role and status changes (decision 017). */
export const ACCOUNTS_LOCK_KEY = 'kairo.admin.accounts';

/**
 * Whether applying `changes` to `account` would leave no active admin. `otherActiveAdmins` counts the active admins
 * other than this account.
 */
export function removesLastActiveAdmin(
  account: { role: UserRole; deactivatedAt: Date | null },
  changes: UpdateAccountDto,
  otherActiveAdmins: number,
): boolean {
  const isActiveAdmin = account.role === 'admin' && account.deactivatedAt === null;
  const staysActiveAdmin = (changes.role ?? account.role) === 'admin' && (changes.active ?? !account.deactivatedAt);
  return isActiveAdmin && !staysActiveAdmin && otherActiveAdmins === 0;
}

/** The admin's side of accounts (decision 017). Callers check AccountPolicy first. */
@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  list(): Promise<User[]> {
    return this.users.find({ order: { createdAt: 'ASC' } });
  }

  /** Creates the account with a generated temporary password, which the caller shows once; it expires in 72 h. */
  async create({ name, email, role }: CreateAccountDto): Promise<{ user: User; temporaryPassword: string }> {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);
    try {
      const user = await this.users.save(
        this.users.create({
          name,
          email,
          role,
          passwordHash,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: temporaryPasswordExpiry(),
        }),
      );
      return { user, temporaryPassword };
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_key')) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Changes the role or the status. Under the advisory lock, so two concurrent changes cannot each see the other's
   * admin and together leave none. Deactivating ends the account's sessions.
   */
  async update(id: string, changes: UpdateAccountDto): Promise<User> {
    const { user, deactivated } = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [ACCOUNTS_LOCK_KEY]);

      const account = await manager.findOneBy(User, { id });
      if (!account) {
        throw new NotFoundException('Account not found');
      }
      const otherActiveAdmins = await manager.countBy(User, {
        id: Not(id),
        role: 'admin',
        deactivatedAt: IsNull(),
      });
      if (removesLastActiveAdmin(account, changes, otherActiveAdmins)) {
        throw new ConflictException('There must be at least one active admin');
      }

      const wasActive = account.deactivatedAt === null;
      if (changes.role !== undefined) {
        account.role = changes.role;
      }
      if (changes.active === false && wasActive) {
        account.deactivatedAt = new Date();
      } else if (changes.active === true) {
        account.deactivatedAt = null;
      }
      return { user: await manager.save(account), deactivated: wasActive && changes.active === false };
    });

    // After the commit: from here on, sign-in and every session check see the account as deactivated.
    if (deactivated) {
      await this.sessions.revokeAll(id);
    }
    return user;
  }

  /**
   * Replaces a forgotten (or expired) password with a new temporary one that works for 72 h, forces a change and
   * ends the account's sessions.
   */
  async resetPassword(id: string): Promise<string> {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);
    const { affected } = await this.users.update(
      { id },
      { passwordHash, mustChangePassword: true, temporaryPasswordExpiresAt: temporaryPasswordExpiry() },
    );
    if (!affected) {
      throw new NotFoundException('Account not found');
    }
    await this.sessions.revokeAll(id);
    return temporaryPassword;
  }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const driverError = error instanceof QueryFailedError ? (error.driverError as { code?: string; constraint?: string }) : undefined;
  return driverError?.code === '23505' && driverError.constraint === constraint;
}
