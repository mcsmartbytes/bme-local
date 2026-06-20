import {
  sqliteTable, text, integer, real, blob, index, uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users for local JWT auth (modeled on ops-sense)
export const users = sqliteTable('users', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  email:         text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  full_name:     text('full_name').notNull(),
  role:          text('role').notNull().default('bookkeeper'),
  is_active:     integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at:    text('created_at').default(sql`(datetime('now'))`),
});

// Core BME local tables (starting minimal)

export const entities = sqliteTable('entities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull().default('business'), // business | client
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity_id: integer('entity_id').references(() => entities.id),
  name: text('name').notNull(),
  email: text('email'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_customers_entity').on(t.entity_id),
]);

export const invoices = sqliteTable('invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity_id: integer('entity_id').references(() => entities.id),
  customer_id: integer('customer_id').references(() => customers.id),
  invoice_number: text('invoice_number').notNull(),
  issue_date: text('issue_date').notNull(),
  due_date: text('due_date'),
  total: real('total').default(0),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_invoices_entity').on(t.entity_id),
  index('idx_invoices_status').on(t.status),
]);

// Smart database tables (SLM powered)

export const operationSnapshots = sqliteTable('operation_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity_id: integer('entity_id').references(() => entities.id),
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
  entity_id: integer('entity_id').references(() => entities.id),
  type: text('type').notNull(),           // analysis | recommendation | issue | notification
  severity: text('severity').notNull().default('warning'), // warning | critical
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
  entity_id: integer('entity_id').references(() => entities.id),
  ref_type: text('ref_type').notNull(),   // invoice | bill | entry
  ref_id: integer('ref_id').notNull(),
  embedding: blob('embedding', { mode: 'buffer' }),
  summary: text('summary'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_emb_entity').on(t.entity_id),
]);