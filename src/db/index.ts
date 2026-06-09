/**
 * Native database (ADR-0007) — SQLite/JSI adapter. WRITTEN but NOT exercised in
 * Phase 1 (web-only): the native module needs the WatermelonDB Expo config plugin
 * (`@morrowdigital/watermelondb-expo-plugin`) + a dev build (`expo prebuild`/`run`) —
 * Expo Go won't load it. Brought up in a later pass (OQ-F). Metro resolves `./index.web.ts`
 * on web, so this file does not run there.
 */
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { migrations } from './migrations';
import { modelClasses } from './models';
import { schema } from './schema';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  dbName: 'tutorplus',
  onSetUpError: (error) => {
    // eslint-disable-next-line no-console
    console.error('[db] SQLite setup failed', error);
  },
});

export const database = new Database({ adapter, modelClasses });
