/**
 * CAT4 — Auth Bypass (P0)
 */

import { verifyToken, generateToken } from '@/lib/auth';

describe('CAT4 | verifyToken — rejects invalid tokens', () => {
  test('test_auth_missingToken_returnsNull', () => {
    expect(verifyToken('')).toBeNull();
  });

  test('test_auth_randomString_returnsNull', () => {
    expect(verifyToken('not.a.jwt.token')).toBeNull();
  });

  test('test_auth_expiredToken_returnsNull', () => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'bme-local-dev-secret-change-in-production';
    const expired = jwt.sign({ userId: 'user-1' }, secret, { expiresIn: -1 });
    expect(verifyToken(expired)).toBeNull();
  });
});

describe('CAT4 | generateToken — produces verifiable tokens', () => {
  test('test_auth_validCredentials_tokenVerifies', () => {
    const token = generateToken('user-42');
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe('user-42');
  });
});

describe('CAT4 | Middleware — public vs protected routes', () => {
  test('test_middleware_login_isPublic', () => {
    const { PUBLIC } = jest.requireActual('@/middleware') as { PUBLIC: string[] };
    expect(PUBLIC).toContain('/login');
    expect(PUBLIC).not.toContain('/api/dashboard');
  });
});