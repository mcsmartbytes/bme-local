import { db } from '@/db';
import {
  users, accounts, customers, vendors, invoices, organizations, entities, company_settings,
} from '@/db/schema';
import { hashPassword } from '@/lib/auth';
import { newId } from '@/lib/id';
import { eq } from 'drizzle-orm';

const DEFAULT_ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'asset', subtype: 'current' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'current' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'current' },
  { code: '3000', name: "Owner's Equity", type: 'equity', subtype: 'capital' },
  { code: '4000', name: 'Sales Revenue', type: 'income', subtype: 'operating' },
  { code: '6000', name: 'Operating Expenses', type: 'expense', subtype: 'operating' },
];

export async function seedBmeDatabase() {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    return { ok: true, message: 'Already initialized — skipping seed.' };
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? 'bookkeeper@local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'change-me-now';
  const userId = newId();
  const orgId = newId();
  const entityId = newId();

  await db.insert(users).values({
    id: userId,
    email: adminEmail,
    password_hash: await hashPassword(adminPassword),
    name: 'Local Bookkeeper',
    business_name: 'Demo Business',
  });

  await db.insert(organizations).values({
    id: orgId,
    name: 'Demo Business',
    created_by: userId,
  });

  await db.insert(entities).values({
    id: entityId,
    organization_id: orgId,
    name: 'Demo Business',
    entity_type: 'company',
  });

  await db.insert(company_settings).values({
    id: newId(),
    user_id: userId,
    company_name: 'Demo Business',
    industry_id: 'general',
  });

  for (const acc of DEFAULT_ACCOUNTS) {
    await db.insert(accounts).values({
      id: newId(),
      user_id: userId,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      normal_balance: ['asset', 'expense'].includes(acc.type) ? 'debit' : 'credit',
    });
  }

  const customerId = newId();
  await db.insert(customers).values({
    id: customerId,
    user_id: userId,
    name: 'Acme Corp',
    email: 'billing@acme.example',
    company: 'Acme Corp',
  });

  await db.insert(vendors).values({
    id: newId(),
    user_id: userId,
    name: 'Office Supply Co',
    email: 'ap@officesupply.example',
  });

  const today = new Date().toISOString().split('T')[0];
  const due = new Date();
  due.setDate(due.getDate() + 30);

  await db.insert(invoices).values({
    id: newId(),
    user_id: userId,
    customer_id: customerId,
    invoice_number: 'INV-001',
    issue_date: today,
    due_date: due.toISOString().split('T')[0],
    subtotal: 1250,
    total: 1250,
    status: 'sent',
  });

  return {
    ok: true,
    message: `Database seeded. Login: ${adminEmail}`,
    warning: process.env.ADMIN_PASSWORD ? undefined : 'Using default password — set ADMIN_PASSWORD in .env.local',
  };
}