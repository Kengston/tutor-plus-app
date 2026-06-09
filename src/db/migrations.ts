/**
 * Schema migrations (ADR-0007). v1 is the initial schema, so there are no migration
 * steps yet. New columns/tables → bump `schema.version` and append a migration here
 * (WatermelonDB applies them on adapter setup).
 */
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [],
});
