import { z } from 'zod';

// User roles enum
export const userRoleSchema = z.enum([
  'client',
  'representative', 
  'accounting',
  'counter_ibn_tachfine',
  'warehouse_la_villette',
  'director_admin'
]);

export type UserRole = z.infer<typeof userRoleSchema>;

// Order status enum
export const orderStatusSchema = z.enum([
  'submitted',
  'validated',
  'in_preparation', 
  'ready',
  'shipped',
  'delivered',
  'refused'
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

// Transfer request status enum  
export const transferStatusSchema = z.enum([
  'pending',
  'in_preparation',
  'ready_to_ship',
  'shipped',
  'received',
  'cancelled'
]);

export type TransferStatus = z.infer<typeof transferStatusSchema>;

// Warehouse enum
export const warehouseSchema = z.enum([
  'ibn_tachfine',
  'drb_omar', 
  'la_villette'
]);

export type Warehouse = z.infer<typeof warehouseSchema>;

// Carrier enum
export const carrierSchema = z.enum([
  'ghazala',
  'sh2t',
  'baha'
]);

export type Carrier = z.infer<typeof carrierSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleSchema,
  sage_id: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Client schema
export const clientSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  company_name: z.string(),
  contact_name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  credit_limit: z.number(),
  current_balance: z.number(),
  overdue_amount: z.number(),
  payment_due_date: z.coerce.date().nullable(),
  is_blocked: z.boolean(),
  representative_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Client = z.infer<typeof clientSchema>;

// Product schema
export const productSchema = z.object({
  id: z.number(),
  reference: z.string(),
  designation: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  vehicle_compatibility: z.string().nullable(),
  base_price: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

// Product substitute schema
export const productSubstituteSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  substitute_product_id: z.number(),
  priority: z.number().int().min(1).max(5),
  created_at: z.coerce.date()
});

export type ProductSubstitute = z.infer<typeof productSubstituteSchema>;

// Stock schema
export const stockSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  warehouse: warehouseSchema,
  quantity: z.number().int().nonnegative(),
  updated_at: z.coerce.date()
});

export type Stock = z.infer<typeof stockSchema>;

// Client product pricing schema
export const clientProductPricingSchema = z.object({
  id: z.number(),
  client_id: z.number(),
  product_id: z.number(),
  custom_price: z.number(),
  discount_percentage: z.number(),
  stock_limit_monthly: z.number().int().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ClientProductPricing = z.infer<typeof clientProductPricingSchema>;

// Order schema
export const orderSchema = z.object({
  id: z.number(),
  client_id: z.number(),
  representative_id: z.number().nullable(),
  order_number: z.string(),
  status: orderStatusSchema,
  total_amount: z.number(),
  carrier: carrierSchema,
  is_grouped: z.boolean(),
  sage_document_number: z.string().nullable(),
  validated_by: z.number().nullable(),
  validated_at: z.coerce.date().nullable(),
  shipped_at: z.coerce.date().nullable(),
  delivered_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Order = z.infer<typeof orderSchema>;

// Order item schema
export const orderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int().positive(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type OrderItem = z.infer<typeof orderItemSchema>;

// Quote schema
export const quoteSchema = z.object({
  id: z.number(),
  client_id: z.number(),
  representative_id: z.number(),
  quote_number: z.string(),
  total_amount: z.number(),
  qr_code: z.string(),
  share_link: z.string(),
  is_converted_to_order: z.boolean(),
  order_id: z.number().nullable(),
  expires_at: z.coerce.date(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Quote = z.infer<typeof quoteSchema>;

// Quote item schema
export const quoteItemSchema = z.object({
  id: z.number(),
  quote_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int().positive(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type QuoteItem = z.infer<typeof quoteItemSchema>;

// Transfer request schema
export const transferRequestSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  product_id: z.number(),
  from_warehouse: warehouseSchema,
  to_warehouse: warehouseSchema,
  quantity_requested: z.number().int().positive(),
  quantity_prepared: z.number().int().nonnegative(),
  status: transferStatusSchema,
  requested_by: z.number(),
  prepared_by: z.number().nullable(),
  received_by: z.number().nullable(),
  requested_at: z.coerce.date(),
  prepared_at: z.coerce.date().nullable(),
  received_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type TransferRequest = z.infer<typeof transferRequestSchema>;

// Input schemas for creating entities
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: userRoleSchema,
  sage_id: z.string().nullable().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createClientInputSchema = z.object({
  user_id: z.number(),
  company_name: z.string(),
  contact_name: z.string(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  credit_limit: z.number().positive(),
  representative_id: z.number().nullable().optional()
});

export type CreateClientInput = z.infer<typeof createClientInputSchema>;

export const createProductInputSchema = z.object({
  reference: z.string(),
  designation: z.string(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  vehicle_compatibility: z.string().nullable().optional(),
  base_price: z.number().positive()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const createOrderInputSchema = z.object({
  client_id: z.number(),
  representative_id: z.number().nullable().optional(),
  carrier: carrierSchema,
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().int().positive()
  }))
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const createQuoteInputSchema = z.object({
  client_id: z.number(),
  representative_id: z.number(),
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().int().positive()
  })),
  expires_in_days: z.number().int().positive().default(30)
});

export type CreateQuoteInput = z.infer<typeof createQuoteInputSchema>;

// Update schemas
export const updateOrderStatusInputSchema = z.object({
  order_id: z.number(),
  status: orderStatusSchema,
  updated_by: z.number()
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

export const updateStockInputSchema = z.object({
  product_id: z.number(),
  warehouse: warehouseSchema,
  quantity: z.number().int().nonnegative()
});

export type UpdateStockInput = z.infer<typeof updateStockInputSchema>;

// Authentication schemas
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const authResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
  client: clientSchema.nullable().optional()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;