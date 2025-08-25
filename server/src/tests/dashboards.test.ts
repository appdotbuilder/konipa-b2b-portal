import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  clientsTable, 
  ordersTable, 
  orderItemsTable,
  productsTable,
  stockTable,
  transferRequestsTable
} from '../db/schema';
import {
  getRepresentativeDashboard,
  getAccountingDashboard,
  getCounterDashboard,
  getWarehouseLaVilletteDashboard,
  getDirectorDashboard
} from '../handlers/dashboards';
// Using simple password hash for testing instead of bcrypt
const hashPassword = async (password: string) => `hashed_${password}`;

describe('Dashboard Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getRepresentativeDashboard', () => {
    it('should return representative dashboard with client data and sales stats', async () => {
      // Create representative user
      const [representative] = await db.insert(usersTable)
        .values({
          email: 'rep@example.com',
          password_hash: await hashPassword('password123'),
          role: 'representative'
        })
        .returning()
        .execute();

      // Create client user
      const [clientUser] = await db.insert(usersTable)
        .values({
          email: 'client@example.com',
          password_hash: await hashPassword('password123'),
          role: 'client'
        })
        .returning()
        .execute();

      // Create client
      const [client] = await db.insert(clientsTable)
        .values({
          user_id: clientUser.id,
          company_name: 'Test Company',
          contact_name: 'John Doe',
          credit_limit: '50000',
          representative_id: representative.id
        })
        .returning()
        .execute();

      // Create product
      const [product] = await db.insert(productsTable)
        .values({
          reference: 'PROD001',
          designation: 'Test Product',
          base_price: '100.00'
        })
        .returning()
        .execute();

      // Create orders
      const [order1] = await db.insert(ordersTable)
        .values({
          client_id: client.id,
          representative_id: representative.id,
          order_number: 'ORD001',
          status: 'delivered',
          total_amount: '500.00',
          carrier: 'ghazala'
        })
        .returning()
        .execute();

      const [order2] = await db.insert(ordersTable)
        .values({
          client_id: client.id,
          representative_id: representative.id,
          order_number: 'ORD002',
          status: 'delivered',
          total_amount: '300.00',
          carrier: 'ghazala'
        })
        .returning()
        .execute();

      // Create order items
      await db.insert(orderItemsTable)
        .values([
          {
            order_id: order1.id,
            product_id: product.id,
            quantity: 5,
            unit_price: '100.00',
            total_price: '500.00'
          },
          {
            order_id: order2.id,
            product_id: product.id,
            quantity: 3,
            unit_price: '100.00',
            total_price: '300.00'
          }
        ])
        .execute();

      const result = await getRepresentativeDashboard(representative.id);

      // Verify clients data
      expect(result.clients).toHaveLength(1);
      expect(result.clients[0].id).toEqual(client.id);
      expect(result.clients[0].company_name).toEqual('Test Company');
      expect(result.clients[0].total_orders).toEqual(2);
      expect(result.clients[0].last_order_date).toBeInstanceOf(Date);

      // Verify sales stats
      expect(typeof result.salesStats.totalSales).toBe('number');
      expect(typeof result.salesStats.monthlyOrders).toBe('number');
      expect(Array.isArray(result.salesStats.topProducts)).toBe(true);

      // Verify commissions
      expect(typeof result.commissions.current_month).toBe('number');
      expect(typeof result.commissions.total).toBe('number');
      expect(result.commissions.total).toBeGreaterThan(0);
    });

    it('should handle representative with no clients', async () => {
      const [representative] = await db.insert(usersTable)
        .values({
          email: 'lonely-rep@example.com',
          password_hash: await hashPassword('password123'),
          role: 'representative'
        })
        .returning()
        .execute();

      const result = await getRepresentativeDashboard(representative.id);

      expect(result.clients).toHaveLength(0);
      expect(result.salesStats.totalSales).toEqual(0);
      expect(result.salesStats.monthlyOrders).toEqual(0);
      expect(result.salesStats.topProducts).toHaveLength(0);
      expect(result.commissions.current_month).toEqual(0);
      expect(result.commissions.total).toEqual(0);
    });
  });

  describe('getAccountingDashboard', () => {
    it('should return accounting dashboard with pending orders and blocked accounts', async () => {
      // Create client user
      const [clientUser] = await db.insert(usersTable)
        .values({
          email: 'client@example.com',
          password_hash: await hashPassword('password123'),
          role: 'client'
        })
        .returning()
        .execute();

      // Create client with overdue amount
      const [client] = await db.insert(clientsTable)
        .values({
          user_id: clientUser.id,
          company_name: 'Overdue Company',
          contact_name: 'Jane Doe',
          credit_limit: '50000',
          overdue_amount: '5000.00',
          is_blocked: true
        })
        .returning()
        .execute();

      // Create validator user
      const [validator] = await db.insert(usersTable)
        .values({
          email: 'validator@example.com',
          password_hash: await hashPassword('password123'),
          role: 'accounting'
        })
        .returning()
        .execute();

      // Create pending order
      await db.insert(ordersTable)
        .values({
          client_id: client.id,
          order_number: 'PEND001',
          status: 'submitted',
          total_amount: '1000.00',
          carrier: 'ghazala'
        })
        .execute();

      // Create validated order for today's stats
      await db.insert(ordersTable)
        .values({
          client_id: client.id,
          order_number: 'VAL001',
          status: 'validated',
          total_amount: '800.00',
          carrier: 'ghazala',
          validated_by: validator.id,
          validated_at: new Date()
        })
        .execute();

      const result = await getAccountingDashboard();

      // Verify pending orders
      expect(result.pendingOrders.length).toBeGreaterThan(0);
      expect(result.pendingOrders[0].client_name).toEqual('Overdue Company');
      expect(typeof result.pendingOrders[0].total_amount).toBe('number');
      expect(result.pendingOrders[0].created_at).toBeInstanceOf(Date);

      // Verify blocked accounts
      expect(result.blockedAccounts.length).toBeGreaterThan(0);
      expect(result.blockedAccounts[0].company_name).toEqual('Overdue Company');
      expect(result.blockedAccounts[0].overdue_amount).toEqual(5000.00);

      // Verify daily validations
      expect(typeof result.dailyValidations.approved).toBe('number');
      expect(typeof result.dailyValidations.refused).toBe('number');
    });

    it('should handle empty data correctly', async () => {
      const result = await getAccountingDashboard();

      expect(result.pendingOrders).toHaveLength(0);
      expect(result.blockedAccounts).toHaveLength(0);
      expect(result.dailyValidations.approved).toEqual(0);
      expect(result.dailyValidations.refused).toEqual(0);
    });
  });

  describe('getCounterDashboard', () => {
    it('should return counter dashboard with preparation data and stock alerts', async () => {
      // Create client user
      const [clientUser] = await db.insert(usersTable)
        .values({
          email: 'client@example.com',
          password_hash: await hashPassword('password123'),
          role: 'client'
        })
        .returning()
        .execute();

      // Create client
      const [client] = await db.insert(clientsTable)
        .values({
          user_id: clientUser.id,
          company_name: 'Prep Company',
          contact_name: 'Prep Manager',
          credit_limit: '50000'
        })
        .returning()
        .execute();

      // Create product with low stock
      const [product] = await db.insert(productsTable)
        .values({
          reference: 'LOW001',
          designation: 'Low Stock Product',
          base_price: '50.00'
        })
        .returning()
        .execute();

      // Create low stock entry
      await db.insert(stockTable)
        .values({
          product_id: product.id,
          warehouse: 'ibn_tachfine',
          quantity: 5
        })
        .execute();

      // Create validated order for preparation
      const [order] = await db.insert(ordersTable)
        .values({
          client_id: client.id,
          order_number: 'PREP001',
          status: 'validated',
          total_amount: '250.00',
          carrier: 'ghazala'
        })
        .returning()
        .execute();

      // Create order item
      await db.insert(orderItemsTable)
        .values({
          order_id: order.id,
          product_id: product.id,
          quantity: 5,
          unit_price: '50.00',
          total_price: '250.00'
        })
        .execute();

      // Create transfer request user
      const [requestUser] = await db.insert(usersTable)
        .values({
          email: 'warehouse@example.com',
          password_hash: await hashPassword('password123'),
          role: 'warehouse_la_villette'
        })
        .returning()
        .execute();

      // Create pending transfer
      await db.insert(transferRequestsTable)
        .values({
          order_id: order.id,
          product_id: product.id,
          from_warehouse: 'la_villette',
          to_warehouse: 'ibn_tachfine',
          quantity_requested: 10,
          status: 'pending',
          requested_by: requestUser.id
        })
        .execute();

      const result = await getCounterDashboard();

      // Verify orders to preparation
      expect(result.ordersToPreparation.length).toBeGreaterThan(0);
      expect(result.ordersToPreparation[0].client_name).toEqual('Prep Company');
      expect(typeof result.ordersToPreparation[0].items_count).toBe('number');
      expect(result.ordersToPreparation[0].created_at).toBeInstanceOf(Date);

      // Verify low stock alerts
      expect(result.lowStockAlerts.length).toBeGreaterThan(0);
      expect(result.lowStockAlerts[0].reference).toEqual('LOW001');
      expect(result.lowStockAlerts[0].stock_level).toEqual(5);

      // Verify pending transfers
      expect(result.pendingTransfers.length).toBeGreaterThan(0);
      expect(result.pendingTransfers[0].product_reference).toEqual('LOW001');
      expect(result.pendingTransfers[0].quantity).toEqual(10);
      expect(result.pendingTransfers[0].from_warehouse).toEqual('la_villette');

      // Verify grouped orders data structure
      expect(Array.isArray(result.groupedOrders)).toBe(true);
    });

    it('should handle empty counter data', async () => {
      const result = await getCounterDashboard();

      expect(result.ordersToPreparation).toHaveLength(0);
      expect(result.groupedOrders).toHaveLength(0);
      expect(result.lowStockAlerts).toHaveLength(0);
      expect(result.pendingTransfers).toHaveLength(0);
    });
  });

  describe('getWarehouseLaVilletteDashboard', () => {
    it('should return warehouse dashboard with transfer requests and today stats', async () => {
      // Create users
      const [requestUser] = await db.insert(usersTable)
        .values({
          email: 'requester@example.com',
          password_hash: await hashPassword('password123'),
          role: 'counter_ibn_tachfine'
        })
        .returning()
        .execute();

      const [clientUser] = await db.insert(usersTable)
        .values({
          email: 'client@example.com',
          password_hash: await hashPassword('password123'),
          role: 'client'
        })
        .returning()
        .execute();

      // Create client
      const [client] = await db.insert(clientsTable)
        .values({
          user_id: clientUser.id,
          company_name: 'Transfer Client',
          contact_name: 'Transfer Manager',
          credit_limit: '50000'
        })
        .returning()
        .execute();

      // Create product
      const [product] = await db.insert(productsTable)
        .values({
          reference: 'TRANS001',
          designation: 'Transfer Product',
          base_price: '75.00'
        })
        .returning()
        .execute();

      // Create order
      const [order] = await db.insert(ordersTable)
        .values({
          client_id: client.id,
          order_number: 'TRANS001',
          status: 'validated',
          total_amount: '375.00',
          carrier: 'ghazala'
        })
        .returning()
        .execute();

      // Create pending transfer request from la_villette
      await db.insert(transferRequestsTable)
        .values({
          order_id: order.id,
          product_id: product.id,
          from_warehouse: 'la_villette',
          to_warehouse: 'ibn_tachfine',
          quantity_requested: 5,
          status: 'pending',
          requested_by: requestUser.id
        })
        .execute();

      // Create today's prepared transfer
      await db.insert(transferRequestsTable)
        .values({
          order_id: order.id,
          product_id: product.id,
          from_warehouse: 'la_villette',
          to_warehouse: 'ibn_tachfine',
          quantity_requested: 3,
          status: 'ready_to_ship',
          requested_by: requestUser.id,
          prepared_at: new Date()
        })
        .execute();

      const result = await getWarehouseLaVilletteDashboard();

      // Verify transfer requests
      expect(result.transferRequests.length).toBeGreaterThan(0);
      expect(result.transferRequests[0].product_reference).toEqual('TRANS001');
      expect(result.transferRequests[0].quantity).toEqual(5);
      expect(result.transferRequests[0].requested_at).toBeInstanceOf(Date);

      // Verify today's transfers
      expect(typeof result.todayTransfers.prepared).toBe('number');
      expect(typeof result.todayTransfers.shipped).toBe('number');
    });

    it('should handle empty warehouse data', async () => {
      const result = await getWarehouseLaVilletteDashboard();

      expect(result.transferRequests).toHaveLength(0);
      expect(result.todayTransfers.prepared).toEqual(0);
      expect(result.todayTransfers.shipped).toEqual(0);
    });
  });

  describe('getDirectorDashboard', () => {
    it('should return comprehensive director dashboard with global stats', async () => {
      // Create representative user
      const [representative] = await db.insert(usersTable)
        .values({
          email: 'rep@example.com',
          password_hash: await hashPassword('password123'),
          role: 'representative'
        })
        .returning()
        .execute();

      // Create client user
      const [clientUser] = await db.insert(usersTable)
        .values({
          email: 'client@example.com',
          password_hash: await hashPassword('password123'),
          role: 'client'
        })
        .returning()
        .execute();

      // Create client with overdue amount
      const [client] = await db.insert(clientsTable)
        .values({
          user_id: clientUser.id,
          company_name: 'Director Test Company',
          contact_name: 'CEO',
          credit_limit: '100000',
          current_balance: '15000.00',
          overdue_amount: '2000.00',
          representative_id: representative.id
        })
        .returning()
        .execute();

      // Create product
      const [product] = await db.insert(productsTable)
        .values({
          reference: 'DIR001',
          designation: 'Director Test Product',
          base_price: '200.00'
        })
        .returning()
        .execute();

      // Create delivered order
      const [deliveredOrder] = await db.insert(ordersTable)
        .values({
          client_id: client.id,
          representative_id: representative.id,
          order_number: 'DIR001',
          status: 'delivered',
          total_amount: '1000.00',
          carrier: 'ghazala'
        })
        .returning()
        .execute();

      // Create active order
      await db.insert(ordersTable)
        .values({
          client_id: client.id,
          representative_id: representative.id,
          order_number: 'DIR002',
          status: 'validated',
          total_amount: '800.00',
          carrier: 'ghazala'
        })
        .execute();

      // Create today's order
      await db.insert(ordersTable)
        .values({
          client_id: client.id,
          representative_id: representative.id,
          order_number: 'DIR003',
          status: 'submitted',
          total_amount: '600.00',
          carrier: 'ghazala',
          created_at: new Date()
        })
        .execute();

      // Create order items for today's popular product
      await db.insert(orderItemsTable)
        .values([
          {
            order_id: deliveredOrder.id,
            product_id: product.id,
            quantity: 5,
            unit_price: '200.00',
            total_price: '1000.00'
          }
        ])
        .execute();

      const result = await getDirectorDashboard();

      // Verify global stats
      expect(typeof result.globalStats.totalClients).toBe('number');
      expect(result.globalStats.totalClients).toBeGreaterThan(0);
      expect(typeof result.globalStats.activeOrders).toBe('number');
      expect(typeof result.globalStats.totalRevenue).toBe('number');
      expect(typeof result.globalStats.overdueAmount).toBe('number');
      expect(result.globalStats.overdueAmount).toEqual(2000.00);

      // Verify client overview
      expect(result.clientOverview.length).toBeGreaterThan(0);
      expect(result.clientOverview[0].company_name).toEqual('Director Test Company');
      expect(typeof result.clientOverview[0].revenue).toBe('number');
      expect(result.clientOverview[0].current_balance).toEqual(15000.00);
      expect(result.clientOverview[0].overdue_amount).toEqual(2000.00);

      // Verify web activity
      expect(typeof result.webActivity.dailyOrders).toBe('number');
      expect(typeof result.webActivity.activeUsers).toBe('number');
      expect(Array.isArray(result.webActivity.topProducts)).toBe(true);

      // Verify representative performance
      expect(result.representativePerformance.length).toBeGreaterThan(0);
      expect(result.representativePerformance[0].representative_id).toEqual(representative.id);
      expect(typeof result.representativePerformance[0].clients_count).toBe('number');
      expect(typeof result.representativePerformance[0].total_sales).toBe('number');
      expect(typeof result.representativePerformance[0].orders_count).toBe('number');
    });

    it('should handle empty director dashboard data', async () => {
      const result = await getDirectorDashboard();

      expect(result.globalStats.totalClients).toEqual(0);
      expect(result.globalStats.activeOrders).toEqual(0);
      expect(result.globalStats.totalRevenue).toEqual(0);
      expect(result.globalStats.overdueAmount).toEqual(0);
      expect(result.clientOverview).toHaveLength(0);
      expect(result.webActivity.dailyOrders).toEqual(0);
      expect(result.webActivity.activeUsers).toEqual(0);
      expect(result.webActivity.topProducts).toHaveLength(0);
      expect(result.representativePerformance).toHaveLength(0);
    });
  });
});