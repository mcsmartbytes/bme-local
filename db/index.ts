import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { mkdirSync } from 'fs';

// Use a data/ subdirectory so the root watcher (and .gitignore) treats it cleanly.
// This prevents the SQLite file modifications from spamming Turbopack/Next HMR.
const dataDir = './data';
try { mkdirSync(dataDir, { recursive: true }); } catch {}

const dbUrl = process.env.TURSO_DATABASE_URL ?? 'file:./data/local.db';

const client = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });