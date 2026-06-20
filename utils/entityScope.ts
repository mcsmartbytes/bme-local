import { NextRequest } from 'next/server';

/**
 * Extracts entity_id from request query params.
 * Returns null if not present (meaning "all entities" / consolidated view).
 */
export function getEntityId(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get('entity_id');
}

/**
 * Applies entity_id filtering to a Supabase query if entity_id is present.
 * Works with any Supabase query builder that supports .eq().
 * Returns the query (modified or unmodified).
 */
export function withEntityScope<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  entityId: string | null,
  column: string = 'entity_id'
): T {
  if (entityId) {
    return query.eq(column, entityId);
  }
  return query;
}
