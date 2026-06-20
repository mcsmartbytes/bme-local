/**
 * CAT7 — LLM / SLM Output Injection (P0)
 * bme-local must treat SLM output as untrusted text.
 * No direct model SDKs or eval of outputs in the main app code.
 */

import * as fs from 'fs'
import * as path from 'path'

const API_DIR = path.join(__dirname, '../../app/api')
const LIB_DIR = path.join(__dirname, '../../lib')

function scanForPattern(dir: string, pattern: RegExp): string[] {
  const hits: string[] = []
  if (!fs.existsSync(dir)) return hits
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) hits.push(...scanForPattern(full, pattern))
    else if (entry.name.endsWith('.ts')) {
      const src = fs.readFileSync(full, 'utf8')
      if (pattern.test(src)) hits.push(full)
    }
  })
  return hits
}

describe('CAT7 | No raw AI SDK calls in main BME paths', () => {
  test('no anthropic or openai sdk direct in api or lib', () => {
    const apiHits = scanForPattern(API_DIR, /@anthropic-ai\/sdk|openai|gpt-|claude-/)
    const libHits = scanForPattern(LIB_DIR, /@anthropic-ai\/sdk|openai|gpt-|claude-/)
    expect(apiHits).toHaveLength(0)
    expect(libHits).toHaveLength(0)
  })
})

describe('CAT7 | SLM output treated as plain text', () => {
  test('intelligence analyze does not eval or dangerously render output', () => {
    const analyze = fs.readFileSync(
      path.join(__dirname, '../../app/api/intelligence/analyze/route.ts'),
      'utf8'
    )
    expect(analyze).not.toMatch(/eval\s*\(/)
    expect(analyze).not.toMatch(/dangerouslySetInnerHTML/)
    expect(analyze).not.toMatch(/innerHTML\s*=/)
  })

  test('slm-client returns text only, no execution', () => {
    const slm = fs.readFileSync(path.join(__dirname, '../../lib/slm-client.ts'), 'utf8')
    expect(slm).not.toMatch(/Function|eval|new Function/)
  })
})