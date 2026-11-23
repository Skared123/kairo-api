import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * An account. Column types are explicit everywhere, so the schema never depends on decorator metadata.
 * See docs/design/v0.1-accounts.md.
 */
@Entity('users')
@Index('users_email_key', ['email'], { unique: true })
// Emails are normalized before saving; the database refuses anything that slipped through.
@Check('users_email_lowercase', '"email" = lower("email")')
export class User {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'users_pkey' })
  id: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text' })
  name: string;

  /** Encoded scrypt hash from PasswordHasher. Never returned by the API. */
  @Column({ type: 'text' })
  passwordHash: string;

  @Column({ type: 'enum', enum: USER_ROLES, enumName: 'user_role', default: 'user' })
  role: UserRole;

  /** True for accounts an admin created or reset with a temporary password (decision 016). */
  @Column({ type: 'boolean', default: false })
  mustChangePassword: boolean;

  /** When the temporary password stops working (decision 026). Null when the user chose their own password. */
  @Column({ type: 'timestamptz', nullable: true })
  temporaryPasswordExpiresAt: Date | null;

  /** Null while the account is active. */
  @Column({ type: 'timestamptz', nullable: true })
  deactivatedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
