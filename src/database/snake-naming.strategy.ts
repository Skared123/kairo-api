import { DefaultNamingStrategy } from 'typeorm';

/** `mustChangePassword` -> `must_change_password`, `userID` -> `user_id`. */
export function snakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * PostgreSQL-style names for columns and join columns (decision 009).
 * Tables already default to snake_case; constraint and index names keep TypeORM's hashes unless set explicitly.
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy {
  override columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    const name = customName || snakeCase(propertyName);
    return embeddedPrefixes.length ? `${embeddedPrefixes.map(snakeCase).join('_')}_${name}` : name;
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return snakeCase(`${tableName}_${columnName ?? propertyName}`);
  }
}
