import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  productsTable, 
  stockTable, 
  productSubstitutesTable, 
  clientProductPricingTable,
  usersTable,
  clientsTable
} from '../db/schema';
import { type CreateProductInput, type Warehouse } from '../schema';
import { 
  createProduct, 
  getProducts, 
  getProductById, 
  getProductStock, 
  getProductSubstitutes, 
  updateProductStock,
  getProductPriceForClient
} from '../handlers/products';
import { eq, and } from 'drizzle-orm';

// Test data
const testProduct: CreateProductInput = {
  reference: 'REF-001',
  designation: 'Test Product',
  brand: 'Test Brand',
  category: 'Test Category',
  vehicle_compatibility: 'Test Vehicle',
  base_price: 99.99
};

const testProductMinimal: CreateProductInput = {
  reference: 'REF-002',
  designation: 'Minimal Product',
  base_price: 49.99
};

describe('Product Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createProduct', () => {
    it('should create a product with all fields', async () => {
      const result = await createProduct(testProduct);

      expect(result.id).toBeDefined();
      expect(result.reference).toEqual('REF-001');
      expect(result.designation).toEqual('Test Product');
      expect(result.brand).toEqual('Test Brand');
      expect(result.category).toEqual('Test Category');
      expect(result.vehicle_compatibility).toEqual('Test Vehicle');
      expect(result.base_price).toEqual(99.99);
      expect(typeof result.base_price).toBe('number');
      expect(result.is_active).toBe(true);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a product with minimal fields', async () => {
      const result = await createProduct(testProductMinimal);

      expect(result.reference).toEqual('REF-002');
      expect(result.designation).toEqual('Minimal Product');
      expect(result.brand).toBeNull();
      expect(result.category).toBeNull();
      expect(result.vehicle_compatibility).toBeNull();
      expect(result.base_price).toEqual(49.99);
      expect(result.is_active).toBe(true);
    });

    it('should save product to database correctly', async () => {
      const result = await createProduct(testProduct);

      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, result.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].reference).toEqual('REF-001');
      expect(parseFloat(products[0].base_price)).toEqual(99.99);
    });

    it('should throw error for duplicate reference', async () => {
      await createProduct(testProduct);
      
      await expect(createProduct(testProduct)).rejects.toThrow();
    });
  });

  describe('getProducts', () => {
    beforeEach(async () => {
      // Create test products
      await createProduct(testProduct);
      await createProduct(testProductMinimal);
      
      // Create inactive product
      await db.insert(productsTable).values({
        reference: 'INACTIVE-001',
        designation: 'Inactive Product',
        base_price: '25.00',
        is_active: false
      }).execute();
    });

    it('should return all active products without filters', async () => {
      const results = await getProducts();

      expect(results).toHaveLength(2);
      expect(results[0].base_price).toBe(99.99);
      expect(typeof results[0].base_price).toBe('number');
      
      // Should be ordered by reference
      expect(results[0].reference).toEqual('REF-001');
      expect(results[1].reference).toEqual('REF-002');
    });

    it('should filter by search term', async () => {
      const results = await getProducts({ search: 'minimal' });

      expect(results).toHaveLength(1);
      expect(results[0].reference).toEqual('REF-002');
    });

    it('should filter by category', async () => {
      const results = await getProducts({ category: 'Test Category' });

      expect(results).toHaveLength(1);
      expect(results[0].reference).toEqual('REF-001');
    });

    it('should filter by brand', async () => {
      const results = await getProducts({ brand: 'Test Brand' });

      expect(results).toHaveLength(1);
      expect(results[0].reference).toEqual('REF-001');
    });

    it('should filter by vehicle model', async () => {
      const results = await getProducts({ vehicleModel: 'Test Vehicle' });

      expect(results).toHaveLength(1);
      expect(results[0].reference).toEqual('REF-001');
    });

    it('should return empty array when no matches', async () => {
      const results = await getProducts({ search: 'nonexistent' });

      expect(results).toHaveLength(0);
    });

    it('should combine multiple filters', async () => {
      const results = await getProducts({ 
        brand: 'Test Brand', 
        category: 'Test Category' 
      });

      expect(results).toHaveLength(1);
      expect(results[0].reference).toEqual('REF-001');
    });
  });

  describe('getProductById', () => {
    let productId: number;

    beforeEach(async () => {
      const product = await createProduct(testProduct);
      productId = product.id;

      // Create inactive product
      await db.insert(productsTable).values({
        reference: 'INACTIVE-001',
        designation: 'Inactive Product',
        base_price: '25.00',
        is_active: false
      }).execute();
    });

    it('should return product by ID', async () => {
      const result = await getProductById(productId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(productId);
      expect(result!.reference).toEqual('REF-001');
      expect(result!.base_price).toEqual(99.99);
      expect(typeof result!.base_price).toBe('number');
    });

    it('should return null for non-existent product', async () => {
      const result = await getProductById(99999);

      expect(result).toBeNull();
    });

    it('should return null for inactive product', async () => {
      const inactiveProducts = await db.select()
        .from(productsTable)
        .where(eq(productsTable.is_active, false))
        .execute();

      const result = await getProductById(inactiveProducts[0].id);

      expect(result).toBeNull();
    });
  });

  describe('getProductStock', () => {
    let productId: number;

    beforeEach(async () => {
      const product = await createProduct(testProduct);
      productId = product.id;

      // Create stock records
      await db.insert(stockTable).values([
        { product_id: productId, warehouse: 'ibn_tachfine', quantity: 100 },
        { product_id: productId, warehouse: 'la_villette', quantity: 50 }
      ]).execute();
    });

    it('should return stock levels for all warehouses', async () => {
      const results = await getProductStock(productId);

      expect(results).toHaveLength(2);
      
      // Should be ordered by warehouse
      expect(results[0].warehouse).toEqual('ibn_tachfine');
      expect(results[0].quantity).toEqual(100);
      expect(results[1].warehouse).toEqual('la_villette');
      expect(results[1].quantity).toEqual(50);
    });

    it('should return empty array for non-existent product', async () => {
      const results = await getProductStock(99999);

      expect(results).toHaveLength(0);
    });

    it('should return empty array for product without stock', async () => {
      const newProduct = await createProduct(testProductMinimal);
      const results = await getProductStock(newProduct.id);

      expect(results).toHaveLength(0);
    });
  });

  describe('getProductSubstitutes', () => {
    let productId: number;
    let substituteId1: number;
    let substituteId2: number;

    beforeEach(async () => {
      const product = await createProduct(testProduct);
      productId = product.id;

      const substitute1 = await createProduct({
        reference: 'SUB-001',
        designation: 'Substitute 1',
        base_price: 89.99
      });
      substituteId1 = substitute1.id;

      const substitute2 = await createProduct({
        reference: 'SUB-002',
        designation: 'Substitute 2',
        base_price: 79.99
      });
      substituteId2 = substitute2.id;

      // Create substitute relationships
      await db.insert(productSubstitutesTable).values([
        { product_id: productId, substitute_product_id: substituteId1, priority: 1 },
        { product_id: productId, substitute_product_id: substituteId2, priority: 2 }
      ]).execute();
    });

    it('should return substitutes ordered by priority', async () => {
      const results = await getProductSubstitutes(productId);

      expect(results).toHaveLength(2);
      expect(results[0].substitute_product_id).toEqual(substituteId1);
      expect(results[0].priority).toEqual(1);
      expect(results[1].substitute_product_id).toEqual(substituteId2);
      expect(results[1].priority).toEqual(2);
    });

    it('should return empty array for non-existent product', async () => {
      const results = await getProductSubstitutes(99999);

      expect(results).toHaveLength(0);
    });

    it('should return empty array for product without substitutes', async () => {
      const newProduct = await createProduct(testProductMinimal);
      const results = await getProductSubstitutes(newProduct.id);

      expect(results).toHaveLength(0);
    });

    it('should limit results to 5 substitutes', async () => {
      // Create additional substitutes
      for (let i = 3; i <= 7; i++) {
        const substitute = await createProduct({
          reference: `SUB-00${i}`,
          designation: `Substitute ${i}`,
          base_price: 69.99
        });

        await db.insert(productSubstitutesTable).values({
          product_id: productId,
          substitute_product_id: substitute.id,
          priority: i
        }).execute();
      }

      const results = await getProductSubstitutes(productId);

      expect(results).toHaveLength(5);
      expect(results[4].priority).toEqual(5);
    });
  });

  describe('updateProductStock', () => {
    let productId: number;
    const warehouse: Warehouse = 'ibn_tachfine';

    beforeEach(async () => {
      const product = await createProduct(testProduct);
      productId = product.id;
    });

    it('should create new stock record when none exists', async () => {
      const result = await updateProductStock(productId, warehouse, 100);

      expect(result.product_id).toEqual(productId);
      expect(result.warehouse).toEqual(warehouse);
      expect(result.quantity).toEqual(100);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update existing stock record', async () => {
      // Create initial stock
      await db.insert(stockTable).values({
        product_id: productId,
        warehouse,
        quantity: 50
      }).execute();

      const result = await updateProductStock(productId, warehouse, 150);

      expect(result.quantity).toEqual(150);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify only one record exists
      const stocks = await db.select()
        .from(stockTable)
        .where(and(
          eq(stockTable.product_id, productId),
          eq(stockTable.warehouse, warehouse)
        ))
        .execute();

      expect(stocks).toHaveLength(1);
      expect(stocks[0].quantity).toEqual(150);
    });

    it('should throw error for non-existent product', async () => {
      await expect(updateProductStock(99999, warehouse, 100))
        .rejects.toThrow(/Product with ID 99999 not found/);
    });

    it('should allow zero quantity', async () => {
      const result = await updateProductStock(productId, warehouse, 0);

      expect(result.quantity).toEqual(0);
    });
  });

  describe('getProductPriceForClient', () => {
    let productId: number;
    let clientId: number;

    beforeEach(async () => {
      const product = await createProduct(testProduct);
      productId = product.id;

      // Create user and client
      const user = await db.insert(usersTable).values({
        email: 'test@client.com',
        password_hash: 'hashed',
        role: 'client'
      }).returning().execute();

      const client = await db.insert(clientsTable).values({
        user_id: user[0].id,
        company_name: 'Test Client',
        contact_name: 'John Doe',
        credit_limit: '10000.00'
      }).returning().execute();

      clientId = client[0].id;
    });

    it('should return base price when no custom pricing exists', async () => {
      const result = await getProductPriceForClient(productId, clientId);

      expect(result.basePrice).toEqual(99.99);
      expect(result.customPrice).toBeUndefined();
      expect(result.discountPercentage).toBeUndefined();
      expect(result.finalPrice).toEqual(99.99);
    });

    it('should return custom pricing when it exists', async () => {
      // Create custom pricing
      await db.insert(clientProductPricingTable).values({
        client_id: clientId,
        product_id: productId,
        custom_price: '89.99',
        discount_percentage: '10.00'
      }).execute();

      const result = await getProductPriceForClient(productId, clientId);

      expect(result.basePrice).toEqual(99.99);
      expect(result.customPrice).toEqual(89.99);
      expect(result.discountPercentage).toEqual(10.00);
      expect(result.finalPrice).toEqual(89.99);
    });

    it('should throw error for non-existent product', async () => {
      await expect(getProductPriceForClient(99999, clientId))
        .rejects.toThrow(/Product with ID 99999 not found/);
    });

    it('should return base price for non-existent client', async () => {
      const result = await getProductPriceForClient(productId, 99999);

      expect(result.basePrice).toEqual(99.99);
      expect(result.finalPrice).toEqual(99.99);
    });
  });
});