import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, clientsTable, productsTable, quotesTable, quoteItemsTable, clientProductPricingTable } from '../db/schema';
import { type CreateQuoteInput } from '../schema';
import { createQuote } from '../handlers/quotes';
import { eq, and } from 'drizzle-orm';

describe('createQuote', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  let testUserId: number;
  let testRepresentativeId: number;
  let testClientId: number;
  let testProduct1Id: number;
  let testProduct2Id: number;

  const setupTestData = async () => {
    // Create test user for client
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@client.com',
        password_hash: 'hashed_password',
        role: 'client',
        sage_id: 'SAGE001',
        is_active: true
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test representative
    const repResult = await db.insert(usersTable)
      .values({
        email: 'rep@company.com',
        password_hash: 'hashed_password',
        role: 'representative',
        sage_id: 'REP001',
        is_active: true
      })
      .returning()
      .execute();
    testRepresentativeId = repResult[0].id;

    // Create test client
    const clientResult = await db.insert(clientsTable)
      .values({
        user_id: testUserId,
        company_name: 'Test Company',
        contact_name: 'John Doe',
        phone: '1234567890',
        address: '123 Test St',
        city: 'Test City',
        credit_limit: '10000.00',
        current_balance: '0.00',
        overdue_amount: '0.00',
        is_blocked: false,
        representative_id: testRepresentativeId
      })
      .returning()
      .execute();
    testClientId = clientResult[0].id;

    // Create test products
    const product1Result = await db.insert(productsTable)
      .values({
        reference: 'PROD001',
        designation: 'Test Product 1',
        brand: 'TestBrand',
        category: 'TestCategory',
        vehicle_compatibility: 'Universal',
        base_price: '99.99',
        is_active: true
      })
      .returning()
      .execute();
    testProduct1Id = product1Result[0].id;

    const product2Result = await db.insert(productsTable)
      .values({
        reference: 'PROD002',
        designation: 'Test Product 2',
        brand: 'TestBrand',
        category: 'TestCategory',
        vehicle_compatibility: 'Universal',
        base_price: '149.99',
        is_active: true
      })
      .returning()
      .execute();
    testProduct2Id = product2Result[0].id;
  };

  it('should create a quote with valid input', async () => {
    await setupTestData();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: testRepresentativeId,
      items: [
        { product_id: testProduct1Id, quantity: 2 },
        { product_id: testProduct2Id, quantity: 1 }
      ],
      expires_in_days: 30
    };

    const result = await createQuote(testInput);

    // Validate basic quote properties
    expect(result.id).toBeDefined();
    expect(result.client_id).toEqual(testClientId);
    expect(result.representative_id).toEqual(testRepresentativeId);
    expect(result.quote_number).toMatch(/^QUO-\d{8}-[A-F0-9]{4}$/);
    expect(result.total_amount).toEqual(349.97); // 2*99.99 + 1*149.99
    expect(result.qr_code).toMatch(/^QUOTE:\d+:[a-f0-9]{64}$/);
    expect(result.share_link).toMatch(/^https:\/\/portal\.konipa\.com\/quotes\/share\/[a-f0-9]{64}$/);
    expect(result.is_converted_to_order).toBe(false);
    expect(result.order_id).toBeNull();
    expect(result.expires_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Check expiration date is approximately 30 days from now
    const expectedExpiry = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
    const timeDiff = Math.abs(result.expires_at.getTime() - expectedExpiry.getTime());
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
  });

  it('should save quote to database correctly', async () => {
    await setupTestData();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: testRepresentativeId,
      items: [
        { product_id: testProduct1Id, quantity: 1 }
      ],
      expires_in_days: 15
    };

    const result = await createQuote(testInput);

    // Verify quote record in database
    const quotes = await db.select()
      .from(quotesTable)
      .where(eq(quotesTable.id, result.id))
      .execute();

    expect(quotes).toHaveLength(1);
    const savedQuote = quotes[0];
    expect(savedQuote.client_id).toEqual(testClientId);
    expect(savedQuote.representative_id).toEqual(testRepresentativeId);
    expect(parseFloat(savedQuote.total_amount)).toEqual(99.99);
    expect(savedQuote.qr_code).toBeDefined();
    expect(savedQuote.share_link).toContain('portal.konipa.com');
  });

  it('should create quote items correctly', async () => {
    await setupTestData();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: testRepresentativeId,
      items: [
        { product_id: testProduct1Id, quantity: 3 },
        { product_id: testProduct2Id, quantity: 2 }
      ],
      expires_in_days: 30
    };

    const result = await createQuote(testInput);

    // Verify quote items in database
    const quoteItems = await db.select()
      .from(quoteItemsTable)
      .where(eq(quoteItemsTable.quote_id, result.id))
      .execute();

    expect(quoteItems).toHaveLength(2);

    // Check first item
    const item1 = quoteItems.find(item => item.product_id === testProduct1Id);
    expect(item1).toBeDefined();
    expect(item1!.quantity).toEqual(3);
    expect(parseFloat(item1!.unit_price)).toEqual(99.99);
    expect(parseFloat(item1!.total_price)).toEqual(299.97);

    // Check second item
    const item2 = quoteItems.find(item => item.product_id === testProduct2Id);
    expect(item2).toBeDefined();
    expect(item2!.quantity).toEqual(2);
    expect(parseFloat(item2!.unit_price)).toEqual(149.99);
    expect(parseFloat(item2!.total_price)).toEqual(299.98);
  });

  it('should use custom pricing when available', async () => {
    await setupTestData();

    // Create custom pricing for client-product combination
    await db.insert(clientProductPricingTable)
      .values({
        client_id: testClientId,
        product_id: testProduct1Id,
        custom_price: '89.99',
        discount_percentage: '10.00',
        stock_limit_monthly: null
      })
      .execute();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: testRepresentativeId,
      items: [
        { product_id: testProduct1Id, quantity: 1 },
        { product_id: testProduct2Id, quantity: 1 }
      ],
      expires_in_days: 30
    };

    const result = await createQuote(testInput);

    // Total should be 89.99 (custom) + 149.99 (base) = 239.98
    expect(result.total_amount).toEqual(239.98);

    // Verify quote items use correct pricing
    const quoteItems = await db.select()
      .from(quoteItemsTable)
      .where(eq(quoteItemsTable.quote_id, result.id))
      .execute();

    const customPricedItem = quoteItems.find(item => item.product_id === testProduct1Id);
    expect(parseFloat(customPricedItem!.unit_price)).toEqual(89.99);

    const basePricedItem = quoteItems.find(item => item.product_id === testProduct2Id);
    expect(parseFloat(basePricedItem!.unit_price)).toEqual(149.99);
  });

  it('should handle custom expiration days', async () => {
    await setupTestData();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: testRepresentativeId,
      items: [
        { product_id: testProduct1Id, quantity: 1 }
      ],
      expires_in_days: 7
    };

    const result = await createQuote(testInput);

    const expectedExpiry = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
    const timeDiff = Math.abs(result.expires_at.getTime() - expectedExpiry.getTime());
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
  });

  it('should fail when client does not exist', async () => {
    await setupTestData();

    const testInput: CreateQuoteInput = {
      client_id: 99999, // Non-existent client
      representative_id: testRepresentativeId,
      items: [
        { product_id: testProduct1Id, quantity: 1 }
      ],
      expires_in_days: 30
    };

    await expect(createQuote(testInput)).rejects.toThrow(/Client with ID 99999 not found/);
  });

  it('should fail when representative does not exist', async () => {
    await setupTestData();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: 99999, // Non-existent representative
      items: [
        { product_id: testProduct1Id, quantity: 1 }
      ],
      expires_in_days: 30
    };

    await expect(createQuote(testInput)).rejects.toThrow(/Representative with ID 99999 not found/);
  });

  it('should fail when representative has wrong role', async () => {
    await setupTestData();

    // Create user with client role instead of representative
    const wrongRoleResult = await db.insert(usersTable)
      .values({
        email: 'client@company.com',
        password_hash: 'hashed_password',
        role: 'client', // Wrong role
        sage_id: 'CLIENT001',
        is_active: true
      })
      .returning()
      .execute();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: wrongRoleResult[0].id,
      items: [
        { product_id: testProduct1Id, quantity: 1 }
      ],
      expires_in_days: 30
    };

    await expect(createQuote(testInput)).rejects.toThrow(/Representative with ID \d+ not found/);
  });

  it('should fail when product does not exist', async () => {
    await setupTestData();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: testRepresentativeId,
      items: [
        { product_id: 99999, quantity: 1 } // Non-existent product
      ],
      expires_in_days: 30
    };

    await expect(createQuote(testInput)).rejects.toThrow(/Product with ID 99999 not found or inactive/);
  });

  it('should fail when product is inactive', async () => {
    await setupTestData();

    // Make product inactive
    await db.update(productsTable)
      .set({ is_active: false })
      .where(eq(productsTable.id, testProduct1Id))
      .execute();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: testRepresentativeId,
      items: [
        { product_id: testProduct1Id, quantity: 1 }
      ],
      expires_in_days: 30
    };

    await expect(createQuote(testInput)).rejects.toThrow(/Product with ID \d+ not found or inactive/);
  });

  it('should handle multiple items with different quantities', async () => {
    await setupTestData();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: testRepresentativeId,
      items: [
        { product_id: testProduct1Id, quantity: 5 },
        { product_id: testProduct2Id, quantity: 3 }
      ],
      expires_in_days: 30
    };

    const result = await createQuote(testInput);

    // 5*99.99 + 3*149.99 = 499.95 + 449.97 = 949.92
    expect(result.total_amount).toEqual(949.92);

    const quoteItems = await db.select()
      .from(quoteItemsTable)
      .where(eq(quoteItemsTable.quote_id, result.id))
      .execute();

    expect(quoteItems).toHaveLength(2);
    const totalFromItems = quoteItems.reduce((sum, item) => sum + parseFloat(item.total_price), 0);
    expect(totalFromItems).toBeCloseTo(949.92, 2);
  });

  it('should generate unique quote numbers', async () => {
    await setupTestData();

    const testInput: CreateQuoteInput = {
      client_id: testClientId,
      representative_id: testRepresentativeId,
      items: [
        { product_id: testProduct1Id, quantity: 1 }
      ],
      expires_in_days: 30
    };

    const result1 = await createQuote(testInput);
    const result2 = await createQuote(testInput);

    expect(result1.quote_number).not.toEqual(result2.quote_number);
    expect(result1.quote_number).toMatch(/^QUO-\d{8}-[A-F0-9]{4}$/);
    expect(result2.quote_number).toMatch(/^QUO-\d{8}-[A-F0-9]{4}$/);
  });
});