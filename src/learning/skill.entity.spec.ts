import { cleanSkillName, skillKey } from './skill.entity.js';

describe('skill names (decision 040)', () => {
  it('saves a name without extra spaces', () => {
    expect(cleanSkillName('  System   design ')).toBe('System design');
  });

  it('compares names ignoring case and spaces', () => {
    expect(skillKey(' TypeScript ')).toBe(skillKey('typescript'));
    expect(skillKey('System  Design')).toBe(skillKey('system design'));
    expect(skillKey('Go')).not.toBe(skillKey('Golang'));
  });
});
