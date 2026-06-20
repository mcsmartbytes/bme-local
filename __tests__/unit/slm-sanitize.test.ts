import { sanitizeSlmOutput } from '@/lib/slm-client'

describe('slm-client | sanitizeSlmOutput', () => {
  test('strips control characters', () => {
    expect(sanitizeSlmOutput('hello\x00world')).toBe('helloworld')
  })

  test('truncates output beyond 500 characters', () => {
    const long = 'a'.repeat(600)
    expect(sanitizeSlmOutput(long)).toHaveLength(500)
  })

  test('trims whitespace', () => {
    expect(sanitizeSlmOutput('  alert text  ')).toBe('alert text')
  })
})