import { ValueTransformer } from 'typeorm';

/**
 * Transformer for storing Date objects as ISO strings in database.
 * This provides cross-database compatibility between SQLite and PostgreSQL.
 * - SQLite doesn't have native date type, stores as TEXT
 * - PostgreSQL can store as TEXT for portability
 */
export const DateTransformer: ValueTransformer = {
  from: (value: string | null): Date | null => {
    if (!value) return null;
    return new Date(value);
  },
  to: (value: Date | null): string | null => {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : value;
  },
};
