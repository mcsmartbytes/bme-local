import { SQL, and, count, desc, asc, eq } from 'drizzle-orm';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { db } from '@/db';

export async function listRows<T extends Record<string, unknown>>({
  table,
  where,
  orderBy,
  page = 1,
  pageSize = 100,
}: {
  table: SQLiteTableWithColumns<any>;
  where?: SQL;
  orderBy?: SQL;
  page?: number;
  pageSize?: number;
}) {
  const offset = (page - 1) * pageSize;
  const base = where ? db.select().from(table).where(where) : db.select().from(table);
  const ordered = orderBy ? base.orderBy(orderBy) : base;
  const rows = await ordered.limit(pageSize).offset(offset);
  const countQuery = where
    ? db.select({ c: count() }).from(table).where(where)
    : db.select({ c: count() }).from(table);
  const [{ c: total }] = await countQuery;
  return { rows: rows as T[], page, pageSize, total: Number(total) };
}

export { eq, and, desc, asc };