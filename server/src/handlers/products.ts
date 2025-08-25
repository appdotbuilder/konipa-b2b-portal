import { db } from '../db';
import { 
  productsTable, 
  stockTable, 
  productSubstitutesTable, 
  clientProductPricingTable 
} from '../db/schema';
import { 
  type CreateProductInput, 
  type Product, 
  type ProductSubstitute, 
  type Stock, 
  type Warehouse 
} from '../schema';
import { eq, and, or, like, ilike, desc, asc, SQL } from 'drizzle-orm';

export async function createProduct(input: CreateProductInput): Promise<Product> {
  try {
    const result = await db.insert(productsTable)
      .values({
        reference: input.reference,
        designation: input.designation,
        brand: input.brand || null,
        category: input.category || null,
        vehicle_compatibility: input.vehicle_compatibility || null,
        base_price: input.base_price.toString() // Convert number to string for numeric column
      })
      .returning()
      .execute();

    const product = result[0];
    return {
      ...product,
      base_price: parseFloat(product.base_price) // Convert string back to number
    };
  } catch (error) {
    console.error('Product creation failed:', error);
    throw error;
  }
}

export async function getProducts(filters?: {
  search?: string;
  category?: string;
  brand?: string;
  vehicleModel?: string;
}): Promise<Product[]> {
  try {
    const conditions: SQL<unknown>[] = [];

    // Add active products filter
    conditions.push(eq(productsTable.is_active, true));

    if (filters) {
      // Search across reference, designation, and brand
      if (filters.search) {
        conditions.push(
          or(
            ilike(productsTable.reference, `%${filters.search}%`),
            ilike(productsTable.designation, `%${filters.search}%`),
            ilike(productsTable.brand, `%${filters.search}%`)
          )!
        );
      }

      // Filter by category
      if (filters.category) {
        conditions.push(eq(productsTable.category, filters.category));
      }

      // Filter by brand
      if (filters.brand) {
        conditions.push(eq(productsTable.brand, filters.brand));
      }

      // Filter by vehicle compatibility
      if (filters.vehicleModel) {
        conditions.push(
          ilike(productsTable.vehicle_compatibility, `%${filters.vehicleModel}%`)
        );
      }
    }

    // Build the final query with all conditions applied at once
    const query = db.select()
      .from(productsTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(asc(productsTable.reference));

    const results = await query.execute();

    return results.map(product => ({
      ...product,
      base_price: parseFloat(product.base_price) // Convert numeric fields
    }));
  } catch (error) {
    console.error('Product fetch failed:', error);
    throw error;
  }
}

export async function getProductById(productId: number): Promise<Product | null> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(and(
        eq(productsTable.id, productId),
        eq(productsTable.is_active, true)
      ))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const product = results[0];
    return {
      ...product,
      base_price: parseFloat(product.base_price) // Convert numeric field
    };
  } catch (error) {
    console.error('Product fetch by ID failed:', error);
    throw error;
  }
}

export async function getProductStock(productId: number): Promise<Stock[]> {
  try {
    // Verify product exists and is active
    const product = await getProductById(productId);
    if (!product) {
      return [];
    }

    const results = await db.select()
      .from(stockTable)
      .where(eq(stockTable.product_id, productId))
      .orderBy(asc(stockTable.warehouse))
      .execute();

    return results;
  } catch (error) {
    console.error('Product stock fetch failed:', error);
    throw error;
  }
}

export async function getProductSubstitutes(productId: number): Promise<ProductSubstitute[]> {
  try {
    // Verify product exists and is active
    const product = await getProductById(productId);
    if (!product) {
      return [];
    }

    const results = await db.select()
      .from(productSubstitutesTable)
      .where(eq(productSubstitutesTable.product_id, productId))
      .orderBy(asc(productSubstitutesTable.priority))
      .limit(5)
      .execute();

    return results;
  } catch (error) {
    console.error('Product substitutes fetch failed:', error);
    throw error;
  }
}

export async function updateProductStock(productId: number, warehouse: Warehouse, quantity: number): Promise<Stock> {
  try {
    // Verify product exists and is active
    const product = await getProductById(productId);
    if (!product) {
      throw new Error(`Product with ID ${productId} not found or inactive`);
    }

    // Check if stock record exists
    const existingStock = await db.select()
      .from(stockTable)
      .where(and(
        eq(stockTable.product_id, productId),
        eq(stockTable.warehouse, warehouse)
      ))
      .execute();

    let result;
    
    if (existingStock.length > 0) {
      // Update existing stock
      result = await db.update(stockTable)
        .set({
          quantity,
          updated_at: new Date()
        })
        .where(and(
          eq(stockTable.product_id, productId),
          eq(stockTable.warehouse, warehouse)
        ))
        .returning()
        .execute();
    } else {
      // Insert new stock record
      result = await db.insert(stockTable)
        .values({
          product_id: productId,
          warehouse,
          quantity
        })
        .returning()
        .execute();
    }

    return result[0];
  } catch (error) {
    console.error('Product stock update failed:', error);
    throw error;
  }
}

export async function getProductPriceForClient(productId: number, clientId: number): Promise<{
  basePrice: number;
  customPrice?: number;
  discountPercentage?: number;
  finalPrice: number;
}> {
  try {
    // Get product base price
    const product = await getProductById(productId);
    if (!product) {
      throw new Error(`Product with ID ${productId} not found or inactive`);
    }

    // Check for custom pricing
    const customPricing = await db.select()
      .from(clientProductPricingTable)
      .where(and(
        eq(clientProductPricingTable.client_id, clientId),
        eq(clientProductPricingTable.product_id, productId)
      ))
      .execute();

    const basePrice = product.base_price;

    if (customPricing.length > 0) {
      const pricing = customPricing[0];
      const customPrice = parseFloat(pricing.custom_price);
      const discountPercentage = parseFloat(pricing.discount_percentage);
      
      return {
        basePrice,
        customPrice,
        discountPercentage,
        finalPrice: customPrice
      };
    }

    // No custom pricing, return base price
    return {
      basePrice,
      finalPrice: basePrice
    };
  } catch (error) {
    console.error('Product price calculation failed:', error);
    throw error;
  }
}