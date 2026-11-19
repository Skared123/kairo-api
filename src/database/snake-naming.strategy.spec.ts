import { SnakeNamingStrategy, snakeCase } from './snake-naming.strategy.js';

describe('snakeCase', () => {
  it.each([
    ['email', 'email'],
    ['createdAt', 'created_at'],
    ['mustChangePassword', 'must_change_password'],
    ['userID', 'user_id'],
    ['HTMLParser', 'html_parser'],
    ['already_snake', 'already_snake'],
  ])('%s -> %s', (input, expected) => {
    expect(snakeCase(input)).toBe(expected);
  });
});

describe('SnakeNamingStrategy', () => {
  const strategy = new SnakeNamingStrategy();

  it('snake-cases column names', () => {
    expect(strategy.columnName('passwordHash', '', [])).toBe('password_hash');
  });

  it('keeps a name set explicitly on the column', () => {
    expect(strategy.columnName('passwordHash', 'pw', [])).toBe('pw');
  });

  it('prefixes embedded columns', () => {
    expect(strategy.columnName('startsAt', '', ['salaryRange'])).toBe('salary_range_starts_at');
  });

  it('snake-cases join columns', () => {
    expect(strategy.joinColumnName('owner', 'id')).toBe('owner_id');
    expect(strategy.joinColumnName('targetCompany', 'id')).toBe('target_company_id');
  });
});
