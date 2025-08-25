import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  pgEnum,
  varchar,
  unique
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums
export const userRoleEnum = pgEnum('user_role', [
  'client',
  'representative', 
  'accounting',
  'counter_ibn_tachfine',
  'warehouse_la_villette',
  'director_admin'
]);

export const orderStatusEnum = pgEnum('order_status', [
  'submitted',
  'validated',
  'in_preparation', 
  'ready',
  'shipped',
  'delivered',
  'refused'
]);

export const transferStatusEnum = pgEnum('transfer_status', [
  'pending',
  'in_preparation',
  'ready_to_ship',
  'shipped',
  'received',
  'cancelled'
]);

export const warehouseEnum = pgEnum('warehouse', [
  'ibn_tachfine',
  'drb_omar', 
  'la_villette'
]);

export const carrierEnum = pgEnum('carrier', [
  'ghazala',
  'sh2t',
  'baha'
]);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  sage_id: varchar('sage_id', { length: 50 }),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Clients table
export const clientsTable = pgTable('clients', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  company_name: varchar('company_name', { length: 255 }).notNull(),
  contact_name: varchar('contact_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  credit_limit: numeric('credit_limit', { precision: 12, scale: 2 }).notNull(),
  current_balance: numeric('current_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  overdue_amount: numeric('overdue_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  payment_due_date: timestamp('payment_due_date'),
  is_blocked: boolean('is_blocked').default(false).notNull(),
  representative_id: integer('representative_id').references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  reference: varchar('reference', { length: 100 }).notNull().unique(),
  designation: text('designation').notNull(),
  brand: varchar('brand', { length: 100 }),
  category: varchar('category', { length: 100 }),
  vehicle_compatibility: text('vehicle_compatibility'),
  base_price: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Product substitutes table
export const productSubstitutesTable = pgTable('product_substitutes', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  substitute_product_id: integer('substitute_product_id').notNull().references(() => productsTable.id),
  priority: integer('priority').notNull(), // 1-5
  created_at: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  uniqueSubstitute: unique().on(table.product_id, table.substitute_product_id)
}));

// Stock table
export const stockTable = pgTable('stock', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  warehouse: warehouseEnum('warehouse').notNull(),
  quantity: integer('quantity').notNull().default(0),
  updated_at: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  uniqueProductWarehouse: unique().on(table.product_id, table.warehouse)
}));

// Client product pricing table
export const clientProductPricingTable = pgTable('client_product_pricing', {
  id: serial('id').primaryKey(),
  client_id: integer('client_id').notNull().references(() => clientsTable.id),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  custom_price: numeric('custom_price', { precision: 10, scale: 2 }).notNull(),
  discount_percentage: numeric('discount_percentage', { precision: 5, scale: 2 }).notNull(),
  stock_limit_monthly: integer('stock_limit_monthly'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  uniqueClientProduct: unique().on(table.client_id, table.product_id)
}));

// Orders table
export const ordersTable = pgTable('orders', {
  id: serial('id').primaryKey(),
  client_id: integer('client_id').notNull().references(() => clientsTable.id),
  representative_id: integer('representative_id').references(() => usersTable.id),
  order_number: varchar('order_number', { length: 50 }).notNull().unique(),
  status: orderStatusEnum('status').default('submitted').notNull(),
  total_amount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  carrier: carrierEnum('carrier').notNull(),
  is_grouped: boolean('is_grouped').default(false).notNull(),
  sage_document_number: varchar('sage_document_number', { length: 50 }),
  validated_by: integer('validated_by').references(() => usersTable.id),
  validated_at: timestamp('validated_at'),
  shipped_at: timestamp('shipped_at'),
  delivered_at: timestamp('delivered_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Order items table
export const orderItemsTable = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull().references(() => ordersTable.id),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Quotes table
export const quotesTable = pgTable('quotes', {
  id: serial('id').primaryKey(),
  client_id: integer('client_id').notNull().references(() => clientsTable.id),
  representative_id: integer('representative_id').notNull().references(() => usersTable.id),
  quote_number: varchar('quote_number', { length: 50 }).notNull().unique(),
  total_amount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  qr_code: text('qr_code').notNull(),
  share_link: text('share_link').notNull(),
  is_converted_to_order: boolean('is_converted_to_order').default(false).notNull(),
  order_id: integer('order_id').references(() => ordersTable.id),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Quote items table
export const quoteItemsTable = pgTable('quote_items', {
  id: serial('id').primaryKey(),
  quote_id: integer('quote_id').notNull().references(() => quotesTable.id),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total_price: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Transfer requests table
export const transferRequestsTable = pgTable('transfer_requests', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull().references(() => ordersTable.id),
  product_id: integer('product_id').notNull().references(() => productsTable.id),
  from_warehouse: warehouseEnum('from_warehouse').notNull(),
  to_warehouse: warehouseEnum('to_warehouse').notNull(),
  quantity_requested: integer('quantity_requested').notNull(),
  quantity_prepared: integer('quantity_prepared').default(0).notNull(),
  status: transferStatusEnum('status').default('pending').notNull(),
  requested_by: integer('requested_by').notNull().references(() => usersTable.id),
  prepared_by: integer('prepared_by').references(() => usersTable.id),
  received_by: integer('received_by').references(() => usersTable.id),
  requested_at: timestamp('requested_at').defaultNow().notNull(),
  prepared_at: timestamp('prepared_at'),
  received_at: timestamp('received_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Define relations
export const usersRelations = relations(usersTable, ({ one, many }) => ({
  client: one(clientsTable, {
    fields: [usersTable.id],
    references: [clientsTable.user_id]
  }),
  representativeClients: many(clientsTable, { relationName: "representative_clients" }),
  ordersAsRepresentative: many(ordersTable, { relationName: "representative_orders" }),
  quotesAsRepresentative: many(quotesTable, { relationName: "representative_quotes" }),
  validatedOrders: many(ordersTable, { relationName: "validated_orders" }),
  transferRequestsRequested: many(transferRequestsTable, { relationName: "requested_transfers" }),
  transferRequestsPrepared: many(transferRequestsTable, { relationName: "prepared_transfers" }),
  transferRequestsReceived: many(transferRequestsTable, { relationName: "received_transfers" })
}));

export const clientsRelations = relations(clientsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [clientsTable.user_id],
    references: [usersTable.id]
  }),
  representative: one(usersTable, {
    fields: [clientsTable.representative_id],
    references: [usersTable.id],
    relationName: "representative_clients"
  }),
  orders: many(ordersTable),
  quotes: many(quotesTable),
  customPricing: many(clientProductPricingTable)
}));

export const productsRelations = relations(productsTable, ({ many }) => ({
  substitutes: many(productSubstitutesTable, { relationName: "product_substitutes" }),
  substituteFor: many(productSubstitutesTable, { relationName: "substitute_for" }),
  stock: many(stockTable),
  orderItems: many(orderItemsTable),
  quoteItems: many(quoteItemsTable),
  customPricing: many(clientProductPricingTable),
  transferRequests: many(transferRequestsTable)
}));

export const productSubstitutesRelations = relations(productSubstitutesTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [productSubstitutesTable.product_id],
    references: [productsTable.id],
    relationName: "product_substitutes"
  }),
  substituteProduct: one(productsTable, {
    fields: [productSubstitutesTable.substitute_product_id],
    references: [productsTable.id],
    relationName: "substitute_for"
  })
}));

export const stockRelations = relations(stockTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [stockTable.product_id],
    references: [productsTable.id]
  })
}));

export const clientProductPricingRelations = relations(clientProductPricingTable, ({ one }) => ({
  client: one(clientsTable, {
    fields: [clientProductPricingTable.client_id],
    references: [clientsTable.id]
  }),
  product: one(productsTable, {
    fields: [clientProductPricingTable.product_id],
    references: [productsTable.id]
  })
}));

export const ordersRelations = relations(ordersTable, ({ one, many }) => ({
  client: one(clientsTable, {
    fields: [ordersTable.client_id],
    references: [clientsTable.id]
  }),
  representative: one(usersTable, {
    fields: [ordersTable.representative_id],
    references: [usersTable.id],
    relationName: "representative_orders"
  }),
  validatedBy: one(usersTable, {
    fields: [ordersTable.validated_by],
    references: [usersTable.id],
    relationName: "validated_orders"
  }),
  items: many(orderItemsTable),
  transferRequests: many(transferRequestsTable),
  quote: one(quotesTable, {
    fields: [ordersTable.id],
    references: [quotesTable.order_id]
  })
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.order_id],
    references: [ordersTable.id]
  }),
  product: one(productsTable, {
    fields: [orderItemsTable.product_id],
    references: [productsTable.id]
  })
}));

export const quotesRelations = relations(quotesTable, ({ one, many }) => ({
  client: one(clientsTable, {
    fields: [quotesTable.client_id],
    references: [clientsTable.id]
  }),
  representative: one(usersTable, {
    fields: [quotesTable.representative_id],
    references: [usersTable.id],
    relationName: "representative_quotes"
  }),
  order: one(ordersTable, {
    fields: [quotesTable.order_id],
    references: [ordersTable.id]
  }),
  items: many(quoteItemsTable)
}));

export const quoteItemsRelations = relations(quoteItemsTable, ({ one }) => ({
  quote: one(quotesTable, {
    fields: [quoteItemsTable.quote_id],
    references: [quotesTable.id]
  }),
  product: one(productsTable, {
    fields: [quoteItemsTable.product_id],
    references: [productsTable.id]
  })
}));

export const transferRequestsRelations = relations(transferRequestsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [transferRequestsTable.order_id],
    references: [ordersTable.id]
  }),
  product: one(productsTable, {
    fields: [transferRequestsTable.product_id],
    references: [productsTable.id]
  }),
  requestedBy: one(usersTable, {
    fields: [transferRequestsTable.requested_by],
    references: [usersTable.id],
    relationName: "requested_transfers"
  }),
  preparedBy: one(usersTable, {
    fields: [transferRequestsTable.prepared_by],
    references: [usersTable.id],
    relationName: "prepared_transfers"
  }),
  receivedBy: one(usersTable, {
    fields: [transferRequestsTable.received_by],
    references: [usersTable.id],
    relationName: "received_transfers"
  })
}));

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  clients: clientsTable,
  products: productsTable,
  productSubstitutes: productSubstitutesTable,
  stock: stockTable,
  clientProductPricing: clientProductPricingTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  quotes: quotesTable,
  quoteItems: quoteItemsTable,
  transferRequests: transferRequestsTable
};