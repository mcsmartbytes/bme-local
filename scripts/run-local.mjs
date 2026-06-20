#!/usr/bin/env node
// Easy wrapper for "run" + "connect" — books-made-easy-local
// Usage: npm run run:local

import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const MODELS_PATH = process.env.MODELS_PATH
  || (process.platform === 'win32' ? 'C:\\Users\\Michelle\\Models' : '/mnt/c/Users/Michelle/Models');
const PORT = process.env.PORT || '3000';
const BASE = `http://localhost:${PORT}`;

console.log('books-made-easy-local');
console.log('Models dir:', MODELS_PATH);
console.log('Port:', PORT);

const dataDir = './data';
try {
  mkdirSync(dataDir, { recursive: true });
} catch {}

if (!existsSync('./data/local.db') && !process.env.TURSO_DATABASE_URL) {
  console.log('No data/local.db yet — will be created on first DB use.');
}

async function waitForHealth(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function tryInit() {
  try {
    const res = await fetch(`${BASE}/api/db/init`);
    const data = await res.json();
    console.log('DB init:', data.message || data.error || data);
  } catch (err) {
    console.log('DB init skipped (server not ready yet):', err.message);
  }
}

const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MODELS_PATH,
    PORT,
  },
});

child.on('exit', (code) => {
  console.log('Server exited with code', code);
});

(async () => {
  const ready = await waitForHealth();
  if (!ready) {
    console.log('Server did not become ready in time. Open manually when ready.');
    return;
  }

  await tryInit();

  console.log(`
Ready to connect:
- Open ${BASE}
- Login: bookkeeper@local / (your ADMIN_PASSWORD or default change-me-now)
- Run Intelligence Analyze from the home page (requires login)
- DB file: ./data/local.db
`);
})();