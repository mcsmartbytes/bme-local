/**
 * CAT4 — Auth Bypass (P0)
 * Verifies JWT handling and protected route contract for bme-local.
 */

import { verifyToken, generateToken } from '@/lib/auth'

describe('CAT4 | verifyToken — rejects invalid tokens', () => {
  test('test_auth_missingToken_returnsNull', () => {
    expect(verifyToken('')).toBeNull()
  })

  test('test_auth_randomString_returnsNull', () => {
    expect(verifyToken('not.a.jwt.token')).toBeNull()
  })

  test('test_auth_tamperedPayload_returnsNull', () => {
    const token = generateToken(1, 'bookkeeper')
    const parts = token.split('.')
    const tampered = parts[0] + '.' + Buffer.from('{"userId":999,"role":"admin"}').toString('base64url') + '.' + parts[2]
    expect(verifyToken(tampered)).toBeNull()
  })

  test('test_auth_expiredToken_returnsNull', () => {
    const jwt = require('jsonwebtoken')
    const secret = process.env.JWT_SECRET || 'bme-local-dev-secret-change-in-production'
    const expired = jwt.sign({ userId: 1, role: 'bookkeeper' }, secret, { expiresIn: -1 })
    expect(verifyToken(expired)).toBeNull()
  })

  test('test_auth_wrongSecret_returnsNull', () => {
    const jwt = require('jsonwebtoken')
    const foreignToken = jwt.sign({ userId: 1, role: 'bookkeeper' }, 'wrong-secret-entirely')
    expect(verifyToken(foreignToken)).toBeNull()
  })
})

describe('CAT4 | generateToken — produces verifiable tokens', () => {
  test('test_auth_validCredentials_tokenVerifies', () => {
    const token = generateToken(42, 'bookkeeper')
    const payload = verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.userId).toBe(42)
    expect(payload!.role).toBe('bookkeeper')
  })

  test('test_auth_tokenDoesNotContainPassword', () => {
    const token = generateToken(1, 'bookkeeper')
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    expect(payload).not.toHaveProperty('password')
    expect(payload).not.toHaveProperty('password_hash')
  })
})

describe('CAT4 | Middleware — public vs protected routes', () => {
  const PUBLIC_ROUTES = [
    '/',
    '/api/auth/login',
    '/api/auth/register',
    '/api/health',
    '/api/db/init',
  ]

  const PROTECTED_ROUTES = [
    '/api/intelligence/analyze',
    '/api/auth/me',
    '/api/db/demo',
  ]

  test('test_middleware_publicRoutes_exported', () => {
    const { PUBLIC } = jest.requireActual('@/middleware') as { PUBLIC: string[] }
    PUBLIC_ROUTES.forEach(route => {
      expect(PUBLIC).toContain(route)
    })
  })

  test('test_middleware_protectedApiRoutes_notPublic', () => {
    const { PUBLIC } = jest.requireActual('@/middleware') as { PUBLIC: string[] }
    PROTECTED_ROUTES.filter(r => r.startsWith('/api/')).forEach(route => {
      expect(PUBLIC).not.toContain(route)
    })
  })
})