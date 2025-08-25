import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import {
  loginInputSchema,
  createUserInputSchema,
  createClientInputSchema,
  createProductInputSchema,
  createOrderInputSchema,
  createQuoteInputSchema,
  updateOrderStatusInputSchema,
  updateStockInputSchema,
  userRoleSchema,
  orderStatusSchema,
  transferStatusSchema,
  warehouseSchema,
  carrierSchema
} from './schema';

// Import handlers
import { login, createUser, resetPassword } from './handlers/auth';
import { 
  createClient, 
  getClientById, 
  getClientsByRepresentative, 
  updateClientCreditStatus,
  getClientDashboardData 
} from './handlers/clients';
import { 
  createProduct, 
  getProducts, 
  getProductById, 
  getProductStock, 
  getProductSubstitutes,
  updateProductStock,
  getProductPriceForClient 
} from './handlers/products';
import { 
  createOrder, 
  getOrdersByClient, 
  getOrderById, 
  getOrderItems,
  updateOrderStatus,
  validateOrder,
  getOrdersForPreparation,
  getGroupedOrders,
  getPendingOrdersForValidation 
} from './handlers/orders';
import { 
  createQuote, 
  getQuoteById, 
  getQuoteByShareToken, 
  getQuoteItems,
  convertQuoteToOrder,
  getQuotesByRepresentative,
  getQuotesByClient 
} from './handlers/quotes';
import { 
  createTransferRequest, 
  getTransferRequestsForWarehouse, 
  updateTransferRequestStatus,
  getTransferRequestsByOrder,
  confirmTransferReception,
  getPendingTransferRequestsForIbnTachfine 
} from './handlers/transfers';
import { 
  getRepresentativeDashboard, 
  getAccountingDashboard, 
  getCounterDashboard,
  getWarehouseLaVilletteDashboard,
  getDirectorDashboard 
} from './handlers/dashboards';
import { 
  setClientCustomPricing, 
  getClientCustomPricing, 
  calculateOrderTotal,
  validateStockLimits 
} from './handlers/pricing';

import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => login(input)),
    
    createUser: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => createUser(input)),
    
    resetPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(({ input }) => resetPassword(input.email))
  }),

  // Client management routes
  clients: router({
    create: publicProcedure
      .input(createClientInputSchema)
      .mutation(({ input }) => createClient(input)),
    
    getById: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => getClientById(input.clientId)),
    
    getByRepresentative: publicProcedure
      .input(z.object({ representativeId: z.number() }))
      .query(({ input }) => getClientsByRepresentative(input.representativeId)),
    
    updateCreditStatus: publicProcedure
      .input(z.object({
        clientId: z.number(),
        isBlocked: z.boolean(),
        updatedBy: z.number()
      }))
      .mutation(({ input }) => updateClientCreditStatus(input.clientId, input.isBlocked, input.updatedBy)),
    
    getDashboardData: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => getClientDashboardData(input.clientId))
  }),

  // Product management routes
  products: router({
    create: publicProcedure
      .input(createProductInputSchema)
      .mutation(({ input }) => createProduct(input)),
    
    getAll: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        brand: z.string().optional(),
        vehicleModel: z.string().optional()
      }).optional())
      .query(({ input }) => getProducts(input)),
    
    getById: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => getProductById(input.productId)),
    
    getStock: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => getProductStock(input.productId)),
    
    getSubstitutes: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(({ input }) => getProductSubstitutes(input.productId)),
    
    updateStock: publicProcedure
      .input(updateStockInputSchema)
      .mutation(({ input }) => updateProductStock(input.product_id, input.warehouse, input.quantity)),
    
    getPriceForClient: publicProcedure
      .input(z.object({
        productId: z.number(),
        clientId: z.number()
      }))
      .query(({ input }) => getProductPriceForClient(input.productId, input.clientId))
  }),

  // Order management routes
  orders: router({
    create: publicProcedure
      .input(createOrderInputSchema)
      .mutation(({ input }) => createOrder(input)),
    
    getByClient: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => getOrdersByClient(input.clientId)),
    
    getById: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(({ input }) => getOrderById(input.orderId)),
    
    getItems: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(({ input }) => getOrderItems(input.orderId)),
    
    updateStatus: publicProcedure
      .input(updateOrderStatusInputSchema)
      .mutation(({ input }) => updateOrderStatus(input)),
    
    validate: publicProcedure
      .input(z.object({
        orderId: z.number(),
        validatedBy: z.number(),
        approve: z.boolean()
      }))
      .mutation(({ input }) => validateOrder(input.orderId, input.validatedBy, input.approve)),
    
    getForPreparation: publicProcedure
      .input(z.object({ warehouse: z.string() }))
      .query(({ input }) => getOrdersForPreparation(input.warehouse)),
    
    getGrouped: publicProcedure
      .input(z.object({
        clientId: z.number(),
        date: z.coerce.date()
      }))
      .query(({ input }) => getGroupedOrders(input.clientId, input.date)),
    
    getPendingValidation: publicProcedure
      .query(() => getPendingOrdersForValidation())
  }),

  // Quote management routes
  quotes: router({
    create: publicProcedure
      .input(createQuoteInputSchema)
      .mutation(({ input }) => createQuote(input)),
    
    getById: publicProcedure
      .input(z.object({ quoteId: z.number() }))
      .query(({ input }) => getQuoteById(input.quoteId)),
    
    getByShareToken: publicProcedure
      .input(z.object({ shareToken: z.string() }))
      .query(({ input }) => getQuoteByShareToken(input.shareToken)),
    
    getItems: publicProcedure
      .input(z.object({ quoteId: z.number() }))
      .query(({ input }) => getQuoteItems(input.quoteId)),
    
    convertToOrder: publicProcedure
      .input(z.object({
        quoteId: z.number(),
        carrier: carrierSchema
      }))
      .mutation(({ input }) => convertQuoteToOrder(input.quoteId, input.carrier)),
    
    getByRepresentative: publicProcedure
      .input(z.object({ representativeId: z.number() }))
      .query(({ input }) => getQuotesByRepresentative(input.representativeId)),
    
    getByClient: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => getQuotesByClient(input.clientId))
  }),

  // Transfer management routes
  transfers: router({
    createRequest: publicProcedure
      .input(z.object({
        orderId: z.number(),
        productId: z.number(),
        fromWarehouse: warehouseSchema,
        toWarehouse: warehouseSchema,
        quantity: z.number().int().positive(),
        requestedBy: z.number()
      }))
      .mutation(({ input }) => createTransferRequest(
        input.orderId,
        input.productId,
        input.fromWarehouse,
        input.toWarehouse,
        input.quantity,
        input.requestedBy
      )),
    
    getForWarehouse: publicProcedure
      .input(z.object({ warehouse: warehouseSchema }))
      .query(({ input }) => getTransferRequestsForWarehouse(input.warehouse)),
    
    updateStatus: publicProcedure
      .input(z.object({
        transferId: z.number(),
        status: transferStatusSchema,
        updatedBy: z.number(),
        quantityPrepared: z.number().int().nonnegative().optional()
      }))
      .mutation(({ input }) => updateTransferRequestStatus(
        input.transferId,
        input.status,
        input.updatedBy,
        input.quantityPrepared
      )),
    
    getByOrder: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(({ input }) => getTransferRequestsByOrder(input.orderId)),
    
    confirmReception: publicProcedure
      .input(z.object({
        transferId: z.number(),
        receivedBy: z.number(),
        quantityReceived: z.number().int().positive()
      }))
      .mutation(({ input }) => confirmTransferReception(
        input.transferId,
        input.receivedBy,
        input.quantityReceived
      )),
    
    getPendingForIbnTachfine: publicProcedure
      .query(() => getPendingTransferRequestsForIbnTachfine())
  }),

  // Dashboard routes
  dashboards: router({
    representative: publicProcedure
      .input(z.object({ representativeId: z.number() }))
      .query(({ input }) => getRepresentativeDashboard(input.representativeId)),
    
    accounting: publicProcedure
      .query(() => getAccountingDashboard()),
    
    counter: publicProcedure
      .query(() => getCounterDashboard()),
    
    warehouseLaVillette: publicProcedure
      .query(() => getWarehouseLaVilletteDashboard()),
    
    director: publicProcedure
      .query(() => getDirectorDashboard())
  }),

  // Pricing management routes
  pricing: router({
    setCustomPricing: publicProcedure
      .input(z.object({
        clientId: z.number(),
        productId: z.number(),
        customPrice: z.number().positive(),
        discountPercentage: z.number().min(0).max(100),
        stockLimitMonthly: z.number().int().positive().optional()
      }))
      .mutation(({ input }) => setClientCustomPricing(
        input.clientId,
        input.productId,
        input.customPrice,
        input.discountPercentage,
        input.stockLimitMonthly
      )),
    
    getClientCustomPricing: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => getClientCustomPricing(input.clientId)),
    
    calculateOrderTotal: publicProcedure
      .input(z.object({
        clientId: z.number(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().int().positive()
        }))
      }))
      .query(({ input }) => calculateOrderTotal(input.clientId, input.items)),
    
    validateStockLimits: publicProcedure
      .input(z.object({
        clientId: z.number(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().int().positive()
        }))
      }))
      .query(({ input }) => validateStockLimits(input.clientId, input.items))
  })
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();