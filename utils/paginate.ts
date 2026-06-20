/**
 * ME-022 — Pagination helpers for list endpoints.
 *
 * Spec: apps/books-made-easy/docs/specs/ME-022-pagination-and-sql-aggregates.md
 *
 * The shape every list endpoint should converge on. Two flavors:
 *
 *   1. `paginate(query, { page, pageSize })` — offset pagination. Returns
 *      `{ rows, page, pageSize, total }`. Total is computed via Supabase's
 *      `count: 'exact'` head. Best for UIs that want page numbers, "X of Y"
 *      counters, jump-to-last-page.
 *
 *   2. `paginateCursor(query, { cursor, pageSize, cursorColumn })` — cursor
 *      pagination. Returns `{ rows, nextCursor }`. Best for infinite-scroll
 *      and high-cardinality lists where offset gets expensive at deep pages.
 *
 * Security posture (CAT 1, CAT 4):
 *  - All numeric params parsed via zod; bad input → throws PaginationParamError
 *    (route handlers convert to 400 via paginationErrorResponse). FAIL LOUD.
 *  - pageSize hard-clamped at MAX_PAGE_SIZE (500). Larger requests rejected.
 *    Prevents `?pageSize=99999999` DoS.
 *  - Negative / zero / non-integer page → rejected.
 *  - Pagination is APPLIED AFTER tenant filtering by the caller's `.eq(...)`
 *    chain. The helper never injects auth — it operates on whatever query
 *    the caller built. If the caller forgot to scope, that's a separate bug
 *    (the api-tenancy-guard-red lint catches it).
 *
 * Backwards-compat:
 *  - Always returns `{ rows, page, pageSize, total }` (additive). Clients
 *    that previously read `.data` continue to work if the route returns
 *    `{ success: true, data: rows, page, pageSize, total }`.
 */
import { z } from 'zod';

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 500;

// =============================================================================
// Validation
// =============================================================================

/**
 * Strict-positive integer schema. zod's `int()` allows zero; we want >=1.
 * Coerces strings (since query params arrive as strings).
 */
const positiveInt = z.coerce.number().int().min(1);

const offsetParamsSchema = z.object({
  page: positiveInt.default(1),
  pageSize: positiveInt.max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const cursorParamsSchema = z.object({
  cursor: z.string().min(1).optional(),
  pageSize: positiveInt.max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursorColumn: z.string().min(1).default('created_at'),
});

export type OffsetPaginationInput = z.input<typeof offsetParamsSchema>;
export type OffsetPaginationParams = z.output<typeof offsetParamsSchema>;
export type CursorPaginationInput = z.input<typeof cursorParamsSchema>;
export type CursorPaginationParams = z.output<typeof cursorParamsSchema>;

export class PaginationParamError extends Error {
  status = 400 as const;
  code = 'pagination_param_invalid' as const;
  constructor(public readonly detail: string, public readonly field?: string) {
    super(detail);
    this.name = 'PaginationParamError';
  }
}

/**
 * Parse offset pagination params from a URLSearchParams (typical request)
 * or a plain object. Throws PaginationParamError on bad input.
 */
export function parseOffsetParams(
  input: URLSearchParams | Record<string, string | number | null | undefined> | null | undefined,
): OffsetPaginationParams {
  const raw = toRecord(input);
  // Drop empty-string params so zod's defaults kick in.
  const cleaned: Record<string, unknown> = {};
  if (raw.page !== '' && raw.page !== undefined && raw.page !== null) cleaned.page = raw.page;
  if (raw.pageSize !== '' && raw.pageSize !== undefined && raw.pageSize !== null) {
    cleaned.pageSize = raw.pageSize;
  }
  const result = offsetParamsSchema.safeParse(cleaned);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.[0] != null ? String(issue.path[0]) : undefined;
    throw new PaginationParamError(issue?.message ?? 'invalid pagination params', field);
  }
  return result.data;
}

export function parseCursorParams(
  input: URLSearchParams | Record<string, string | number | null | undefined> | null | undefined,
): CursorPaginationParams {
  const raw = toRecord(input);
  const cleaned: Record<string, unknown> = {};
  if (raw.cursor !== '' && raw.cursor !== undefined && raw.cursor !== null) cleaned.cursor = raw.cursor;
  if (raw.pageSize !== '' && raw.pageSize !== undefined && raw.pageSize !== null) {
    cleaned.pageSize = raw.pageSize;
  }
  if (raw.cursorColumn !== '' && raw.cursorColumn !== undefined && raw.cursorColumn !== null) {
    cleaned.cursorColumn = raw.cursorColumn;
  }
  const result = cursorParamsSchema.safeParse(cleaned);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.[0] != null ? String(issue.path[0]) : undefined;
    throw new PaginationParamError(issue?.message ?? 'invalid pagination params', field);
  }
  return result.data;
}

function toRecord(
  input: URLSearchParams | Record<string, string | number | null | undefined> | null | undefined,
): Record<string, unknown> {
  if (!input) return {};
  if (typeof URLSearchParams !== 'undefined' && input instanceof URLSearchParams) {
    return {
      page: input.get('page') ?? undefined,
      pageSize: input.get('pageSize') ?? undefined,
      cursor: input.get('cursor') ?? undefined,
      cursorColumn: input.get('cursorColumn') ?? undefined,
    };
  }
  return input as Record<string, unknown>;
}

// =============================================================================
// Result shapes
// =============================================================================

export interface OffsetPage<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CursorPage<T> {
  rows: T[];
  nextCursor: string | null;
}

// =============================================================================
// Supabase query interface — minimal duck-type so tests can mock without
// pulling the full @supabase/supabase-js types.
// =============================================================================

/**
 * Minimum surface area we need from a PostgrestFilterBuilder to apply
 * pagination. Real Supabase queries satisfy this naturally; tests can stub
 * it.
 */
export interface PaginatableQuery<T> {
  range(from: number, to: number): PaginatableQuery<T>;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): PaginatableQuery<T>;
  gt(column: string, value: string | number): PaginatableQuery<T>;
  lt(column: string, value: string | number): PaginatableQuery<T>;
  // The terminal call returns a Promise<PostgrestResponse>; we accept a
  // `then` to detect thenable.
  then<R1 = unknown, R2 = never>(
    onFulfilled?: (
      value: { data: T[] | null; error: unknown; count?: number | null },
    ) => R1 | PromiseLike<R1>,
    onRejected?: (reason: unknown) => R2 | PromiseLike<R2>,
  ): Promise<R1 | R2>;
}

// =============================================================================
// paginate — offset pagination
// =============================================================================

/**
 * Wrap a Supabase query with offset pagination. The helper does NOT decide
 * `.select()` (the caller already chose columns); it adds `.range()` only.
 *
 * Total count: the caller is responsible for choosing `.select('*', { count:
 * 'exact' })` (or a column-restricted equivalent) BEFORE handing the query in.
 * If the caller didn't request count, `total` will be NaN — we coerce to 0
 * with a clear shape, and the caller should treat `total === 0 && rows.length
 * > 0` as "I forgot to ask for count" and fix the route.
 *
 * @example
 * ```ts
 * const params = parseOffsetParams(request.nextUrl.searchParams);
 * const query = supabaseAdmin
 *   .from('invoices')
 *   .select('*, customers(id, name)', { count: 'exact' })
 *   .eq('user_id', userId)
 *   .order('issue_date', { ascending: false });
 * const page = await paginate(query, params);
 * return NextResponse.json({ success: true, ...page });
 * ```
 */
export async function paginate<T>(
  query: PaginatableQuery<T>,
  params: OffsetPaginationInput | OffsetPaginationParams = {},
): Promise<OffsetPage<T>> {
  const parsed = isParsedOffset(params) ? params : parseOffsetParams(params as Record<string, string | number | null | undefined>);
  const { page, pageSize } = parsed;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const ranged = query.range(from, to);
  const { data, error, count } = await ranged;

  if (error) {
    // Surface DB error to the route — the route's catch block converts to 500.
    throw error;
  }

  return {
    rows: (data ?? []) as T[],
    page,
    pageSize,
    total: typeof count === 'number' ? count : 0,
  };
}

function isParsedOffset(p: unknown): p is OffsetPaginationParams {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return typeof o.page === 'number' && typeof o.pageSize === 'number';
}

// =============================================================================
// paginateCursor — cursor pagination
// =============================================================================

/**
 * Wrap a Supabase query with cursor pagination. Default cursor column is
 * `created_at`; pass `cursorColumn` to override (`due_date`, etc.).
 *
 * Direction: descending (newest-first). For ascending lists, callers should
 * use offset pagination or a future keyset variant.
 *
 * @example
 * ```ts
 * const params = parseCursorParams(request.nextUrl.searchParams);
 * const query = supabaseAdmin
 *   .from('bank_transactions')
 *   .select('*')
 *   .eq('user_id', userId);
 * const page = await paginateCursor(query, params);
 * return NextResponse.json({ success: true, ...page });
 * ```
 */
export async function paginateCursor<T extends Record<string, unknown>>(
  query: PaginatableQuery<T>,
  params: CursorPaginationInput | CursorPaginationParams = {},
): Promise<CursorPage<T>> {
  const parsed = isParsedCursor(params) ? params : parseCursorParams(params as Record<string, string | number | null | undefined>);
  const { cursor, pageSize, cursorColumn } = parsed;

  let q = query;
  if (cursor) q = q.lt(cursorColumn, cursor);
  q = q.order(cursorColumn, { ascending: false });

  // Fetch one extra row to determine if there's a next page.
  const ranged = q.range(0, pageSize); // pageSize+1 items
  const { data, error } = await ranged;

  if (error) throw error;

  const rows = (data ?? []) as T[];
  let nextCursor: string | null = null;
  if (rows.length > pageSize) {
    const overflow = rows.pop()!; // mutate: remove the extra
    const last = rows[rows.length - 1];
    const cursorVal = last?.[cursorColumn];
    nextCursor = cursorVal != null ? String(cursorVal) : String((overflow as any)?.[cursorColumn] ?? '');
  }

  return { rows, nextCursor };
}

function isParsedCursor(p: unknown): p is CursorPaginationParams {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return typeof o.pageSize === 'number' && typeof o.cursorColumn === 'string';
}

// =============================================================================
// Error -> Response helpers
// =============================================================================

/**
 * Convert a thrown PaginationParamError to a structured NextResponse-shaped
 * object. Returns null if the error isn't ours — caller falls through.
 *
 * Returned object is `{ status, body }`; routes wrap with NextResponse.json().
 * Kept framework-agnostic so the helper can be unit-tested without next/server.
 */
export function paginationErrorResponse(
  err: unknown,
): { status: number; body: { success: false; error: string; field?: string; detail: string } } | null {
  if (err instanceof PaginationParamError) {
    return {
      status: err.status,
      body: {
        success: false,
        error: err.code,
        field: err.field,
        detail: err.detail,
      },
    };
  }
  return null;
}
