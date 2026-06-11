/**
 * Web database (ADR-0007) — the Phase-1 runtime. LokiJS adapter backed by IndexedDB
 * (`useWebWorker:false`, `useIncrementalIndexedDB:true`). Metro resolves THIS file on
 * web (`.web.ts`) and `./index.ts` (SQLite) on native — same schema/models, different
 * adapter; consumers import from `@/db`.
 */
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { migrations } from './migrations';
import { modelClasses } from './models';
import { schema } from './schema';

const adapter = new LokiJSAdapter({
  schema,
  migrations,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  dbName: 'tutorplus',
  onSetUpError: (error) => {
    console.error('[db] LokiJS setup failed', error);
  },
});

export const database = new Database({ adapter, modelClasses });
