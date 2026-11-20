import { PasswordHasher } from '@nestjs/authentication';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { User } from '../users/user.entity.js';
import type { ChangePasswordDto, SetupDto } from './auth.schemas.js';

/** Key of the advisory lock that makes concurrent setups take turns (decision 010). */
export const SETUP_LOCK_KEY = 'kairo.auth.setup';

/** Creates the first admin and checks passwords. Only this class reads password hashes. */
@Injectable()
export class CredentialsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async needsSetup(): Promise<boolean> {
    return !(await this.users.exists());
  }

  /**
   * Creates the first admin, only while there are no users (decision 010). The advisory lock makes concurrent calls
   * take turns, so the second one finds the first admin and is refused.
   */
  async setup({ name, email, password }: SetupDto): Promise<User> {
    // Cheap early answer once setup is done, so a closed endpoint never spends a scrypt hash.
    if (!(await this.needsSetup())) {
      throw new ConflictException('Setup is already complete');
    }
    // Hashed before the transaction, so the lock is never held during the slow part.
    const passwordHash = await this.passwordHasher.hash(password);

    return this.dataSource.transaction(async (manager) => {
      // Released automatically when the transaction ends.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [SETUP_LOCK_KEY]);
      if (await manager.exists(User)) {
        throw new ConflictException('Setup is already complete');
      }
      return manager.save(manager.create(User, { name, email, passwordHash, role: 'admin' }));
    });
  }

  /**
   * The active user with this email and password, or null. Unknown emails, wrong passwords and deactivated accounts
   * all get null, and take the same time, so the answer reveals nothing about which accounts exist.
   */
  async verify(email: string, password: string): Promise<User | null> {
    const user = await this.users.findOneBy({ email });
    // With no user, verify() checks a dummy hash instead.
    const valid = await this.passwordHasher.verify(password, user?.passwordHash);
    if (!valid || !user || user.deactivatedAt) {
      return null;
    }

    // The hashing cost was raised since this hash was stored: upgrade it while we have the plaintext.
    if (this.passwordHasher.needsRehash(user.passwordHash)) {
      await this.users.update({ id: user.id }, { passwordHash: await this.passwordHasher.hash(password) });
    }
    return user;
  }

  /**
   * Replaces the user's password after checking the current one, and clears the forced change (decision 016).
   * A wrong current password is a 400, not a 401, so the web app does not take it for an expired session.
   */
  async changePassword(userId: string, { currentPassword, newPassword }: ChangePasswordDto): Promise<User> {
    const user = await this.users.findOneByOrFail({ id: userId });
    if (!(await this.passwordHasher.verify(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.passwordHash = await this.passwordHasher.hash(newPassword);
    user.mustChangePassword = false;
    return this.users.save(user);
  }
}
