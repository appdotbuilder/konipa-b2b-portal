import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  clientsTable, 
  productsTable, 
  clientProductPricingTable,
  ordersTable,
  orderItemsTable 
} from '../db/schema';
import { 
  setClientCustomPricing, 
  getClientCustomPricing,
  calculateOrderTotal,
  validateStockLimits 
} from '../handlers/pricing';
import { eq } from 'drizzle-orm';

describe('Pricing handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testClientId: number;
  let testProductId1: number;
  let testProductId2: number;

  beforeEach(async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@client.com',
        password_hash: 'hashed_password',
        role: 'client'
      })
      .returning()
      .execute();
    testUserId = user[0].id;

    // Create test client
    const client = await db.insert(clientsTable)
      .values({
        user_id: testUserId,
        company_name: 'Test Company',
        contact_name: 'John Doe',
        credit_limit: '10000'
      })
      .returning()
      .execute();
    testClientId = client[0].id;

    // Create test products
    const products = await db.insert(productsTable)
      .values([
        {
          reference: 'PROD001',
          designation: 'Test Product 1',
          base_price: '100.00'
        },
        {
          reference: 'PROD002',
          designation: 'Test Product 2',
          base_price: '200.00'
        }
      ])
      .returning()
      .execute();
    testProductId1 = products[0].id;
    testProductId2 = products[1].id;
  });

  describe('setClientCustomPricing', () => {
    it('should create new custom pricing', async () => {
      const result = await setClientCustomPricing(
        testClientId,
        testProductId1,
        85.50,
        15.0,
        100
      );

      expect(result.client_id).toEqual(testClientId);
      expect(result.product_id).toEqual(testProductId1);
      expect(result.custom_price).toEqual(85.50);
      expect(result.discount_percentage).toEqual(15.0);
      expect(result.stock_limit_monthly).toEqual(100);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should update existing custom pricing', async () => {
      // Create initial pricing
      await setClientCustomPricing(testClientId, testProductId1, 90.0, 10.0, 50);

      // Update pricing
      const result = await setClientCustomPricing(
        testClientId,
        testProductId1,
        80.0,
        20.0,
        75
      );

      expect(result.custom_price).toEqual(80.0);
      expect(result.discount_percentage).toEqual(20.0);
      expect(result.stock_limit_monthly).toEqual(75);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify only one record exists
      const pricingRecords = await db.select()
        .from(clientProductPricingTable)
        .where(eq(clientProductPricingTable.client_id, testClientId))
        .execute();
      
      expect(pricingRecords).toHaveLength(1);
    });

    it('should save custom pricing to database', async () => {
      await setClientCustomPricing(testClientId, testProductId1, 95.0, 5.0);

      const saved = await db.select()
        .from(clientProductPricingTable)
        .where(eq(clientProductPricingTable.client_id, testClientId))
        .execute();

      expect(saved).toHaveLength(1);
      expect(parseFloat(saved[0].custom_price)).toEqual(95.0);
      expect(parseFloat(saved[0].discount_percentage)).toEqual(5.0);
      expect(saved[0].stock_limit_monthly).toBeNull();
    });

    it('should throw error for non-existent client', async () => {
      await expect(
        setClientCustomPricing(99999, testProductId1, 100.0, 0)
      ).rejects.toThrow(/Client with ID 99999 not found/i);
    });

    it('should throw error for non-existent product', async () => {
      await expect(
        setClientCustomPricing(testClientId, 99999, 100.0, 0)
      ).rejects.toThrow(/Product with ID 99999 not found/i);
    });
  });

  describe('getClientCustomPricing', () => {
    it('should return empty array for client with no custom pricing', async () => {
      const result = await getClientCustomPricing(testClientId);
      
      expect(result).toHaveLength(0);
    });

    it('should return all custom pricing for client', async () => {
      // Create multiple pricing records
      await setClientCustomPricing(testClientId, testProductId1, 85.0, 15.0, 100);
      await setClientCustomPricing(testClientId, testProductId2, 180.0, 10.0, 50);

      const result = await getClientCustomPricing(testClientId);

      expect(result).toHaveLength(2);
      
      const pricing1 = result.find(p => p.product_id === testProductId1);
      const pricing2 = result.find(p => p.product_id === testProductId2);

      expect(pricing1).toBeDefined();
      expect(pricing1!.custom_price).toEqual(85.0);
      expect(pricing1!.discount_percentage).toEqual(15.0);
      expect(pricing1!.stock_limit_monthly).toEqual(100);

      expect(pricing2).toBeDefined();
      expect(pricing2!.custom_price).toEqual(180.0);
      expect(pricing2!.discount_percentage).toEqual(10.0);
      expect(pricing2!.stock_limit_monthly).toEqual(50);
    });

    it('should throw error for non-existent client', async () => {
      await expect(
        getClientCustomPricing(99999)
      ).rejects.toThrow(/Client with ID 99999 not found/i);
    });
  });

  describe('calculateOrderTotal', () => {
    it('should calculate total with base prices when no custom pricing exists', async () => {
      const items = [
        { productId: testProductId1, quantity: 2 },
        { productId: testProductId2, quantity: 1 }
      ];

      const result = await calculateOrderTotal(testClientId, items);

      expect(result.items).toHaveLength(2);
      expect(result.totalAmount).toEqual(400.0); // (100 * 2) + (200 * 1)

      const item1 = result.items.find(i => i.productId === testProductId1);
      const item2 = result.items.find(i => i.productId === testProductId2);

      expect(item1!.basePrice).toEqual(100.0);
      expect(item1!.finalPrice).toEqual(100.0);
      expect(item1!.totalPrice).toEqual(200.0);
      expect(item1!.customPrice).toBeUndefined();
      expect(item1!.discountPercentage).toBeUndefined();

      expect(item2!.basePrice).toEqual(200.0);
      expect(item2!.finalPrice).toEqual(200.0);
      expect(item2!.totalPrice).toEqual(200.0);
    });

    it('should calculate total with custom prices', async () => {
      // Set custom pricing
      await setClientCustomPricing(testClientId, testProductId1, 80.0, 0, 100);
      await setClientCustomPricing(testClientId, testProductId2, 0, 25.0, 50);

      const items = [
        { productId: testProductId1, quantity: 2 },
        { productId: testProductId2, quantity: 1 }
      ];

      const result = await calculateOrderTotal(testClientId, items);

      expect(result.totalAmount).toEqual(310.0); // (80 * 2) + (150 * 1)

      const item1 = result.items.find(i => i.productId === testProductId1);
      const item2 = result.items.find(i => i.productId === testProductId2);

      expect(item1!.customPrice).toEqual(80.0);
      expect(item1!.finalPrice).toEqual(80.0);
      expect(item1!.totalPrice).toEqual(160.0);

      expect(item2!.discountPercentage).toEqual(25.0);
      expect(item2!.finalPrice).toEqual(150.0); // 200 - 25%
      expect(item2!.totalPrice).toEqual(150.0);
    });

    it('should prioritize custom price over discount percentage', async () => {
      // Set both custom price and discount
      await setClientCustomPricing(testClientId, testProductId1, 90.0, 50.0);

      const items = [{ productId: testProductId1, quantity: 1 }];
      const result = await calculateOrderTotal(testClientId, items);

      const item = result.items[0];
      expect(item.customPrice).toEqual(90.0);
      expect(item.discountPercentage).toEqual(50.0);
      expect(item.finalPrice).toEqual(90.0); // Custom price takes priority
      expect(result.totalAmount).toEqual(90.0);
    });

    it('should throw error for non-existent client', async () => {
      const items = [{ productId: testProductId1, quantity: 1 }];

      await expect(
        calculateOrderTotal(99999, items)
      ).rejects.toThrow(/Client with ID 99999 not found/i);
    });

    it('should throw error for non-existent product', async () => {
      const items = [{ productId: 99999, quantity: 1 }];

      await expect(
        calculateOrderTotal(testClientId, items)
      ).rejects.toThrow(/Product with ID 99999 not found/i);
    });
  });

  describe('validateStockLimits', () => {
    it('should return valid when no stock limits are set', async () => {
      const items = [
        { productId: testProductId1, quantity: 100 },
        { productId: testProductId2, quantity: 50 }
      ];

      const result = await validateStockLimits(testClientId, items);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should return valid when within stock limits', async () => {
      // Set stock limits
      await setClientCustomPricing(testClientId, testProductId1, 100.0, 0, 100);
      await setClientCustomPricing(testClientId, testProductId2, 200.0, 0, 50);

      const items = [
        { productId: testProductId1, quantity: 50 },
        { productId: testProductId2, quantity: 25 }
      ];

      const result = await validateStockLimits(testClientId, items);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should return violations when exceeding stock limits', async () => {
      // Set stock limits
      await setClientCustomPricing(testClientId, testProductId1, 100.0, 0, 30);
      await setClientCustomPricing(testClientId, testProductId2, 200.0, 0, 20);

      const items = [
        { productId: testProductId1, quantity: 50 },
        { productId: testProductId2, quantity: 25 }
      ];

      const result = await validateStockLimits(testClientId, items);

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2);

      const violation1 = result.violations.find(v => v.productId === testProductId1);
      const violation2 = result.violations.find(v => v.productId === testProductId2);

      expect(violation1!.requestedQuantity).toEqual(50);
      expect(violation1!.monthlyLimit).toEqual(30);
      expect(violation1!.remainingLimit).toEqual(30);

      expect(violation2!.requestedQuantity).toEqual(25);
      expect(violation2!.monthlyLimit).toEqual(20);
      expect(violation2!.remainingLimit).toEqual(20);
    });

    it('should account for existing orders in current month', async () => {
      // Set stock limit
      await setClientCustomPricing(testClientId, testProductId1, 100.0, 0, 100);

      // Create an existing order this month
      const order = await db.insert(ordersTable)
        .values({
          client_id: testClientId,
          order_number: 'ORD001',
          status: 'submitted',
          total_amount: '500.00',
          carrier: 'ghazala'
        })
        .returning()
        .execute();

      await db.insert(orderItemsTable)
        .values({
          order_id: order[0].id,
          product_id: testProductId1,
          quantity: 60,
          unit_price: '100.00',
          total_price: '6000.00'
        })
        .execute();

      // Try to order more items
      const items = [{ productId: testProductId1, quantity: 50 }];
      const result = await validateStockLimits(testClientId, items);

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);

      const violation = result.violations[0];
      expect(violation.productId).toEqual(testProductId1);
      expect(violation.requestedQuantity).toEqual(50);
      expect(violation.remainingLimit).toEqual(40); // 100 - 60 = 40
      expect(violation.monthlyLimit).toEqual(100);
    });

    it('should throw error for non-existent client', async () => {
      const items = [{ productId: testProductId1, quantity: 1 }];

      await expect(
        validateStockLimits(99999, items)
      ).rejects.toThrow(/Client with ID 99999 not found/i);
    });
  });
});