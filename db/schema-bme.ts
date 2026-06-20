/**
 * Full Books Made Easy schema — ported from turso/schema.sql (+ multi-entity entities).
 * UUIDs generated in application layer (crypto.randomUUID()).
 * Timestamps stored as ISO 8601 TEXT strings.
 */
import {
  sqliteTable,
  text,
  integer,
  real,
  blob,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================
// USERS (NextAuth / local JWT)
// ============================================
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash'),
  name: text('name'),
  business_name: text('business_name'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_users_email').on(t.email),
]);

// ============================================
// MULTI-ENTITY (from 006_multi_entity.sql)
// ============================================
export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tax_id: text('tax_id'),
  fiscal_year_start: text('fiscal_year_start').default('january'),
  currency: text('currency').default('USD'),
  logo_url: text('logo_url'),
  created_by: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_organizations_created_by').on(t.created_by),
]);

export const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  organization_id: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  legal_name: text('legal_name'),
  entity_type: text('entity_type').notNull().default('company'),
  tax_id: text('tax_id'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  country: text('country').default('United States'),
  currency: text('currency').default('USD'),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_entities_organization_id').on(t.organization_id),
]);

// ============================================
// CUSTOMERS
// ============================================
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  country: text('country').default('United States'),
  notes: text('notes'),
  balance: real('balance').default(0),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  external_id: text('external_id'),
  external_source: text('external_source'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_customers_user_id').on(t.user_id),
  index('idx_customers_external').on(t.external_source, t.external_id),
]);

// ============================================
// VENDORS
// ============================================
export const vendors = sqliteTable('vendors', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  country: text('country').default('United States'),
  tax_id: text('tax_id'),
  notes: text('notes'),
  balance: real('balance').default(0),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  external_id: text('external_id'),
  external_source: text('external_source'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_vendors_user_id').on(t.user_id),
  index('idx_vendors_external').on(t.external_source, t.external_id),
]);

// ============================================
// CHART OF ACCOUNTS
// ============================================
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  subtype: text('subtype'),
  description: text('description'),
  balance: real('balance').default(0),
  normal_balance: text('normal_balance').default('debit'),
  help_text: text('help_text'),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  uniqueIndex('accounts_user_id_code_unique').on(t.user_id, t.code),
  index('idx_accounts_user_id').on(t.user_id),
  index('idx_accounts_type').on(t.user_id, t.type),
]);

// ============================================
// CATEGORIES
// ============================================
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  icon: text('icon'),
  color: text('color'),
  tax_deductible: integer('tax_deductible', { mode: 'boolean' }).default(false),
  deduction_percentage: real('deduction_percentage').default(0),
  irs_category: text('irs_category'),
  description: text('description'),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_categories_user_id').on(t.user_id),
  index('idx_categories_type').on(t.user_id, t.type),
]);

// ============================================
// PRODUCTS / SERVICES
// ============================================
export const products_services = sqliteTable('products_services', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(),
  sku: text('sku'),
  price: real('price').default(0),
  cost: real('cost').default(0),
  category_id: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  account_id: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  tax_rate: real('tax_rate').default(0),
  is_taxable: integer('is_taxable', { mode: 'boolean' }).default(true),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_products_services_user_id').on(t.user_id),
  index('idx_products_services_type').on(t.user_id, t.type),
]);

// ============================================
// JOBS
// ============================================
export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  customer_id: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  job_number: text('job_number').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  start_date: text('start_date'),
  end_date: text('end_date'),
  estimated_revenue: real('estimated_revenue').default(0),
  estimated_cost: real('estimated_cost').default(0),
  actual_revenue: real('actual_revenue').default(0),
  actual_cost: real('actual_cost').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_jobs_user_id').on(t.user_id),
  index('idx_jobs_customer_id').on(t.customer_id),
  index('idx_jobs_status').on(t.status),
]);

// ============================================
// JOB PHASES
// ============================================
export const job_phases = sqliteTable('job_phases', {
  id: text('id').primaryKey(),
  job_id: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  estimated_hours: real('estimated_hours').default(0),
  estimated_cost: real('estimated_cost').default(0),
  actual_hours: real('actual_hours').default(0),
  actual_cost: real('actual_cost').default(0),
  sort_order: integer('sort_order').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_job_phases_job_id').on(t.job_id),
]);

// ============================================
// BANK ACCOUNTS (before deposits — FK target)
// ============================================
export const bank_accounts = sqliteTable('bank_accounts', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  account_id: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  institution: text('institution'),
  account_type: text('account_type').notNull().default('checking'),
  account_number_last4: text('account_number_last4'),
  routing_number_last4: text('routing_number_last4'),
  current_balance: real('current_balance').default(0),
  available_balance: real('available_balance').default(0),
  currency: text('currency').default('USD'),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  last_reconciled_date: text('last_reconciled_date'),
  last_reconciled_balance: real('last_reconciled_balance').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_bank_accounts_user_id').on(t.user_id),
  index('idx_bank_accounts_account_id').on(t.account_id),
]);

// ============================================
// RECONCILIATIONS
// ============================================
export const reconciliations = sqliteTable('reconciliations', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bank_account_id: text('bank_account_id').notNull().references(() => bank_accounts.id, { onDelete: 'cascade' }),
  statement_date: text('statement_date').notNull(),
  statement_balance: real('statement_balance').notNull(),
  opening_balance: real('opening_balance').notNull().default(0),
  cleared_balance: real('cleared_balance').default(0),
  difference: real('difference').default(0),
  status: text('status').notNull().default('in_progress'),
  completed_at: text('completed_at'),
  notes: text('notes'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_reconciliations_user_id').on(t.user_id),
  index('idx_reconciliations_bank_account_id').on(t.bank_account_id),
  index('idx_reconciliations_status').on(t.status),
]);

// ============================================
// ESTIMATES
// ============================================
export const estimates = sqliteTable('estimates', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  customer_id: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  estimate_number: text('estimate_number').notNull(),
  status: text('status').notNull().default('draft'),
  issue_date: text('issue_date').notNull(),
  expiry_date: text('expiry_date').notNull(),
  subtotal: real('subtotal').default(0),
  tax_amount: real('tax_amount').default(0),
  total: real('total').default(0),
  notes: text('notes'),
  terms: text('terms'),
  converted_invoice_id: text('converted_invoice_id'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_estimates_user_id').on(t.user_id),
  index('idx_estimates_customer_id').on(t.customer_id),
  index('idx_estimates_status').on(t.status),
]);

// ============================================
// INVOICES
// ============================================
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  customer_id: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  job_id: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  job_phase_id: text('job_phase_id').references(() => job_phases.id, { onDelete: 'set null' }),
  estimate_id: text('estimate_id'),
  invoice_number: text('invoice_number').notNull(),
  status: text('status').default('draft'),
  issue_date: text('issue_date').notNull().default(sql`(date('now'))`),
  due_date: text('due_date').notNull(),
  subtotal: real('subtotal').default(0),
  tax_rate: real('tax_rate').default(0),
  tax_amount: real('tax_amount').default(0),
  total: real('total').default(0),
  amount_paid: real('amount_paid').default(0),
  notes: text('notes'),
  terms: text('terms'),
  external_id: text('external_id'),
  external_source: text('external_source'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  uniqueIndex('invoices_user_id_invoice_number_unique').on(t.user_id, t.invoice_number),
  index('idx_invoices_user_id').on(t.user_id),
  index('idx_invoices_customer_id').on(t.customer_id),
  index('idx_invoices_status').on(t.user_id, t.status),
  index('idx_invoices_job_id').on(t.job_id),
  index('idx_invoices_estimate_id').on(t.estimate_id),
  index('idx_invoices_external').on(t.external_source, t.external_id),
]);

// estimates.converted_invoice_id → invoices (circular; no Drizzle FK)
export const estimate_items = sqliteTable('estimate_items', {
  id: text('id').primaryKey(),
  estimate_id: text('estimate_id').notNull().references(() => estimates.id, { onDelete: 'cascade' }),
  product_service_id: text('product_service_id').references(() => products_services.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  quantity: real('quantity').default(1),
  rate: real('rate').default(0),
  amount: real('amount').default(0),
  sort_order: integer('sort_order').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_estimate_items_estimate_id').on(t.estimate_id),
]);

// ============================================
// INVOICE LINE ITEMS
// ============================================
export const invoice_items = sqliteTable('invoice_items', {
  id: text('id').primaryKey(),
  invoice_id: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  product_service_id: text('product_service_id').references(() => products_services.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  quantity: real('quantity').default(1),
  rate: real('rate').default(0),
  amount: real('amount').default(0),
  account_id: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  sort_order: integer('sort_order').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

// ============================================
// BILLS
// ============================================
export const bills = sqliteTable('bills', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vendor_id: text('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  job_id: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  job_phase_id: text('job_phase_id').references(() => job_phases.id, { onDelete: 'set null' }),
  bill_number: text('bill_number'),
  status: text('status').default('draft'),
  bill_date: text('bill_date').notNull().default(sql`(date('now'))`),
  due_date: text('due_date').notNull(),
  category: text('category'),
  category_id: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  subtotal: real('subtotal').default(0),
  tax_amount: real('tax_amount').default(0),
  total: real('total').default(0),
  amount_paid: real('amount_paid').default(0),
  description: text('description'),
  notes: text('notes'),
  external_id: text('external_id'),
  external_source: text('external_source'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_bills_user_id').on(t.user_id),
  index('idx_bills_vendor_id').on(t.vendor_id),
  index('idx_bills_status').on(t.user_id, t.status),
  index('idx_bills_job_id').on(t.job_id),
  index('idx_bills_external').on(t.external_source, t.external_id),
]);

export const bill_items = sqliteTable('bill_items', {
  id: text('id').primaryKey(),
  bill_id: text('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  category_id: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  quantity: real('quantity').default(1),
  rate: real('rate').default(0),
  amount: real('amount').default(0),
  account_id: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  sort_order: integer('sort_order').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

// ============================================
// PAYMENTS (unified)
// ============================================
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  payment_number: text('payment_number').notNull(),
  type: text('type').notNull(),
  invoice_id: text('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  bill_id: text('bill_id').references(() => bills.id, { onDelete: 'set null' }),
  amount: real('amount').notNull(),
  payment_date: text('payment_date').notNull(),
  payment_method: text('payment_method').notNull().default('bank_transfer'),
  reference: text('reference'),
  notes: text('notes'),
  deposit_id: text('deposit_id'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_payments_user_id').on(t.user_id),
  index('idx_payments_deposit_id').on(t.deposit_id),
  index('idx_payments_invoice_id').on(t.invoice_id),
  index('idx_payments_bill_id').on(t.bill_id),
  index('idx_payments_type').on(t.type),
  index('idx_payments_date').on(t.payment_date),
]);

// ============================================
// DEPOSITS
// ============================================
export const deposits = sqliteTable('deposits', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bank_account_id: text('bank_account_id').references(() => bank_accounts.id, { onDelete: 'set null' }),
  deposit_number: text('deposit_number').notNull(),
  deposit_date: text('deposit_date').notNull().default(sql`(date('now'))`),
  total: real('total').default(0),
  memo: text('memo'),
  status: text('status').notNull().default('pending'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_deposits_user_id').on(t.user_id),
  index('idx_deposits_bank_account_id').on(t.bank_account_id),
  index('idx_deposits_status').on(t.status),
]);

// ============================================
// PAYMENTS RECEIVED / MADE (legacy)
// ============================================
export const payments_received = sqliteTable('payments_received', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invoice_id: text('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  customer_id: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  amount: real('amount').notNull(),
  payment_date: text('payment_date').notNull().default(sql`(date('now'))`),
  payment_method: text('payment_method'),
  reference_number: text('reference_number'),
  notes: text('notes'),
  deposit_id: text('deposit_id').references(() => deposits.id, { onDelete: 'set null' }),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

export const payments_made = sqliteTable('payments_made', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bill_id: text('bill_id').references(() => bills.id, { onDelete: 'set null' }),
  vendor_id: text('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  amount: real('amount').notNull(),
  payment_date: text('payment_date').notNull().default(sql`(date('now'))`),
  payment_method: text('payment_method'),
  reference_number: text('reference_number'),
  notes: text('notes'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

export const deposit_items = sqliteTable('deposit_items', {
  id: text('id').primaryKey(),
  deposit_id: text('deposit_id').notNull().references(() => deposits.id, { onDelete: 'cascade' }),
  payment_id: text('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  description: text('description'),
  amount: real('amount').notNull().default(0),
  sort_order: integer('sort_order').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_deposit_items_deposit_id').on(t.deposit_id),
  index('idx_deposit_items_payment_id').on(t.payment_id),
]);

// ============================================
// JOURNAL ENTRIES
// ============================================
export const journal_entries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entry_number: text('entry_number').notNull(),
  entry_date: text('entry_date').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('draft'),
  total_debits: real('total_debits').default(0),
  total_credits: real('total_credits').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_journal_entries_user_id').on(t.user_id),
  index('idx_journal_entries_date').on(t.entry_date),
  index('idx_journal_entries_status').on(t.status),
]);

export const journal_entry_lines = sqliteTable('journal_entry_lines', {
  id: text('id').primaryKey(),
  journal_entry_id: text('journal_entry_id').notNull().references(() => journal_entries.id, { onDelete: 'cascade' }),
  account_id: text('account_id').notNull().references(() => accounts.id),
  description: text('description'),
  debit: real('debit').default(0),
  credit: real('credit').default(0),
  sort_order: integer('sort_order').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_journal_entry_lines_entry_id').on(t.journal_entry_id),
  index('idx_journal_entry_lines_account_id').on(t.account_id),
]);

// ============================================
// BANK TRANSACTIONS
// ============================================
export const bank_transactions = sqliteTable('bank_transactions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bank_account_id: text('bank_account_id').notNull().references(() => bank_accounts.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  type: text('type').notNull().default('debit'),
  category_id: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  payee: text('payee'),
  reference: text('reference'),
  check_number: text('check_number'),
  memo: text('memo'),
  status: text('status').notNull().default('unreviewed'),
  matched_transaction_type: text('matched_transaction_type'),
  matched_transaction_id: text('matched_transaction_id'),
  reconciliation_id: text('reconciliation_id').references(() => reconciliations.id, { onDelete: 'set null' }),
  is_reconciled: integer('is_reconciled', { mode: 'boolean' }).default(false),
  import_id: text('import_id'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_bank_transactions_user_id').on(t.user_id),
  index('idx_bank_transactions_bank_account_id').on(t.bank_account_id),
  index('idx_bank_transactions_date').on(t.date),
  index('idx_bank_transactions_status').on(t.status),
  index('idx_bank_transactions_reconciliation_id').on(t.reconciliation_id),
]);

// ============================================
// CUSTOM REPORTS
// ============================================
export const custom_reports = sqliteTable('custom_reports', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  data_source: text('data_source').notNull(),
  columns: text('columns').notNull().default('[]'),
  filters: text('filters').notNull().default('[]'),
  sort_by: text('sort_by'),
  sort_order: text('sort_order').default('asc'),
  group_by: text('group_by'),
  date_field: text('date_field'),
  is_favorite: integer('is_favorite', { mode: 'boolean' }).default(false),
  last_run_at: text('last_run_at'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_custom_reports_user_id').on(t.user_id),
  index('idx_custom_reports_data_source').on(t.data_source),
  index('idx_custom_reports_is_favorite').on(t.is_favorite),
]);

// ============================================
// COMPANY SETTINGS
// ============================================
export const company_settings = sqliteTable('company_settings', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  company_name: text('company_name'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  country: text('country').default('United States'),
  tax_id: text('tax_id'),
  fiscal_year_start: text('fiscal_year_start').default('january'),
  currency: text('currency').default('USD'),
  date_format: text('date_format').default('MM/DD/YYYY'),
  logo_url: text('logo_url'),
  industry_id: text('industry_id'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
});

// ============================================
// EXPENSES
// ============================================
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vendor: text('vendor'),
  description: text('description'),
  amount: real('amount').notNull(),
  date: text('date').notNull(),
  category_id: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  job_id: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  is_business: integer('is_business', { mode: 'boolean' }).default(true),
  payment_method: text('payment_method'),
  receipt_url: text('receipt_url'),
  po_number: text('po_number'),
  notes: text('notes'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_expenses_user_id').on(t.user_id),
  index('idx_expenses_date').on(t.date),
  index('idx_expenses_category_id').on(t.category_id),
]);

// ============================================
// AUTO-CATEGORIZATION RULES
// ============================================
export const merchant_rules = sqliteTable('merchant_rules', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  merchant_pattern: text('merchant_pattern').notNull(),
  category_id: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  is_business: integer('is_business', { mode: 'boolean' }).default(true),
  priority: integer('priority').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_merchant_rules_user_id').on(t.user_id),
]);

export const item_category_rules = sqliteTable('item_category_rules', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  item_pattern: text('item_pattern').notNull(),
  category_id: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  is_business: integer('is_business', { mode: 'boolean' }).default(true),
  priority: integer('priority').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_item_category_rules_user_id').on(t.user_id),
]);

// ============================================
// RECURRING / SUBSCRIPTION TRACKING
// ============================================
export const recurring_expenses = sqliteTable('recurring_expenses', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vendor: text('vendor').notNull(),
  description: text('description'),
  amount: real('amount').notNull(),
  category_id: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  frequency: text('frequency').notNull().default('monthly'),
  next_due_date: text('next_due_date').notNull(),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_recurring_expenses_user_id').on(t.user_id),
]);

export const detected_subscriptions = sqliteTable('detected_subscriptions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vendor: text('vendor').notNull(),
  vendor_normalized: text('vendor_normalized'),
  avg_amount: real('avg_amount'),
  min_amount: real('min_amount'),
  max_amount: real('max_amount'),
  frequency: text('frequency'),
  confidence: real('confidence').default(0),
  first_seen: text('first_seen'),
  last_seen: text('last_seen'),
  next_expected: text('next_expected'),
  occurrence_count: integer('occurrence_count').default(0),
  category_id: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  category_name: text('category_name'),
  is_confirmed: integer('is_confirmed', { mode: 'boolean' }).default(false),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  is_dismissed: integer('is_dismissed', { mode: 'boolean' }).default(false),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  uniqueIndex('detected_subscriptions_user_vendor_unique').on(t.user_id, t.vendor_normalized),
  index('idx_detected_subscriptions_user_id').on(t.user_id),
]);

export const subscription_price_history = sqliteTable('subscription_price_history', {
  id: text('id').primaryKey(),
  subscription_id: text('subscription_id').notNull().references(() => detected_subscriptions.id, { onDelete: 'cascade' }),
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  detected_date: text('detected_date').notNull(),
  expense_id: text('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
  price_change: real('price_change'),
  price_change_pct: real('price_change_pct'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  uniqueIndex('subscription_price_history_sub_date_unique').on(t.subscription_id, t.detected_date),
  index('idx_subscription_price_history_sub_id').on(t.subscription_id),
]);

// ============================================
// BUDGETS & MILEAGE
// ============================================
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category'),
  category_id: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  amount: real('amount').notNull(),
  period: text('period').notNull().default('monthly'),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_budgets_user_id').on(t.user_id),
]);

export const mileage = sqliteTable('mileage', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  distance: real('distance').notNull(),
  is_business: integer('is_business', { mode: 'boolean' }).default(true),
  purpose: text('purpose'),
  start_location: text('start_location'),
  end_location: text('end_location'),
  notes: text('notes'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_mileage_user_id').on(t.user_id),
  index('idx_mileage_date').on(t.date),
]);

// ============================================
// CUSTOMER CRM
// ============================================
export const customer_notes = sqliteTable('customer_notes', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  customer_id: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_customer_notes_user_id').on(t.user_id),
  index('idx_customer_notes_customer_id').on(t.customer_id),
]);

export const customer_todos = sqliteTable('customer_todos', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  customer_id: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  is_completed: integer('is_completed', { mode: 'boolean' }).default(false),
  due_date: text('due_date'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_customer_todos_user_id').on(t.user_id),
  index('idx_customer_todos_customer_id').on(t.customer_id),
]);

// ============================================
// INVOICE REMINDERS & LATE FEES
// ============================================
export const reminder_settings = sqliteTable('reminder_settings', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  enabled: integer('enabled', { mode: 'boolean' }).default(false),
  grace_period_days: integer('grace_period_days').default(3),
  frequency_days: integer('frequency_days').default(7),
  max_reminders: integer('max_reminders').default(3),
  default_message: text('default_message').default(
    'This is a friendly reminder that your invoice is past due. Please arrange payment at your earliest convenience.',
  ),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_reminder_settings_user_id').on(t.user_id),
]);

export const invoice_reminders = sqliteTable('invoice_reminders', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invoice_id: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  reminder_type: text('reminder_type').notNull().default('manual'),
  message: text('message'),
  sent_at: text('sent_at').default(sql`(datetime('now'))`),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_invoice_reminders_user_id').on(t.user_id),
  index('idx_invoice_reminders_invoice_id').on(t.invoice_id),
]);

export const late_fee_settings = sqliteTable('late_fee_settings', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  enabled: integer('enabled', { mode: 'boolean' }).default(false),
  fee_type: text('fee_type').notNull().default('percentage'),
  fee_amount: real('fee_amount').default(1.5),
  grace_period_days: integer('grace_period_days').default(5),
  auto_apply: integer('auto_apply', { mode: 'boolean' }).default(false),
  max_fees_per_invoice: integer('max_fees_per_invoice').default(3),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_late_fee_settings_user_id').on(t.user_id),
]);

export const invoice_late_fees = sqliteTable('invoice_late_fees', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invoice_id: text('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  fee_type: text('fee_type').notNull(),
  fee_amount: real('fee_amount').notNull(),
  calculated_fee: real('calculated_fee').notNull(),
  invoice_total_before: real('invoice_total_before').notNull(),
  invoice_total_after: real('invoice_total_after').notNull(),
  applied_type: text('applied_type').notNull().default('manual'),
  reversed: integer('reversed', { mode: 'boolean' }).default(false),
  applied_at: text('applied_at').default(sql`(datetime('now'))`),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_invoice_late_fees_user_id').on(t.user_id),
  index('idx_invoice_late_fees_invoice_id').on(t.invoice_id),
]);

// ============================================
// SMART DATABASE TABLES (bme-local extensions)
// ============================================
export const operationSnapshots = sqliteTable('operation_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity_id: text('entity_id').references(() => entities.id),
  week_start: text('week_start').notNull(),
  revenue: real('revenue').default(0),
  ar_total: real('ar_total').default(0),
  ap_total: real('ap_total').default(0),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  uniqueIndex('idx_snapshot_entity_week').on(t.entity_id, t.week_start),
]);

export const smartAlerts = sqliteTable('smart_alerts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity_id: text('entity_id').references(() => entities.id),
  type: text('type').notNull(),
  severity: text('severity').notNull().default('warning'),
  headline: text('headline').notNull(),
  body: text('body').notNull(),
  data_json: text('data_json'),
  is_read: integer('is_read', { mode: 'boolean' }).default(false),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_alerts_entity').on(t.entity_id),
  index('idx_alerts_read').on(t.is_read),
]);

export const embeddings = sqliteTable('embeddings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity_id: text('entity_id').references(() => entities.id),
  ref_type: text('ref_type').notNull(),
  ref_id: text('ref_id').notNull(),
  embedding: blob('embedding', { mode: 'buffer' }),
  summary: text('summary'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_emb_entity').on(t.entity_id),
]);