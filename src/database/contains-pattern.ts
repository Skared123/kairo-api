/** An ILIKE pattern that finds `text` anywhere, matched literally: % and _ lose their LIKE meaning. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
