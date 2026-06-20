import { db } from '@/db';
import { bookkeeper_firms } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getFirmByOwner(userId: string) {
  const [firm] = await db.select().from(bookkeeper_firms)
    .where(and(eq(bookkeeper_firms.owner_id, userId), eq(bookkeeper_firms.is_active, true)))
    .limit(1);
  return firm ?? null;
}