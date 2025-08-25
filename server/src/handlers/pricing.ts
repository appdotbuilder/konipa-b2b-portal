import { db } from '../db';
import { 
  clientProductPricingTable, 
  productsTable, 
  clientsTable, 
  orderItemsTable,
  ordersTable 
} from '../db/schema';
import { type ClientProductPricing } from '../schema';
import { eq, and, sum, gte } from 'drizzle-orm';

export async function setClientCustomPricing(
    clientId: number,
    productId: number,
    customPrice: number,
    discountPercentage: number,
    stockLimitMonthly?: number
): Promise<ClientProductPricing> {
    try {
        // Verify client exists
        const client = await db.select()
            .from(clientsTable)
            .where(eq(clientsTable.id, clientId))
            .limit(1)
            .execute();
        
        if (client.length === 0) {
            throw new Error(`Client with ID ${clientId} not found`);
        }

        // Verify product exists
        const product = await db.select()
            .from(productsTable)
            .where(eq(productsTable.id, productId))
            .limit(1)
            .execute();
        
        if (product.length === 0) {
            throw new Error(`Product with ID ${productId} not found`);
        }

        // Check if pricing already exists for this client-product combination
        const existingPricing = await db.select()
            .from(clientProductPricingTable)
            .where(and(
                eq(clientProductPricingTable.client_id, clientId),
                eq(clientProductPricingTable.product_id, productId)
            ))
            .limit(1)
            .execute();

        let result;
        
        if (existingPricing.length > 0) {
            // Update existing pricing
            const updated = await db.update(clientProductPricingTable)
                .set({
                    custom_price: customPrice.toString(),
                    discount_percentage: discountPercentage.toString(),
                    stock_limit_monthly: stockLimitMonthly || null,
                    updated_at: new Date()
                })
                .where(and(
                    eq(clientProductPricingTable.client_id, clientId),
                    eq(clientProductPricingTable.product_id, productId)
                ))
                .returning()
                .execute();
            
            result = updated[0];
        } else {
            // Insert new pricing
            const inserted = await db.insert(clientProductPricingTable)
                .values({
                    client_id: clientId,
                    product_id: productId,
                    custom_price: customPrice.toString(),
                    discount_percentage: discountPercentage.toString(),
                    stock_limit_monthly: stockLimitMonthly || null
                })
                .returning()
                .execute();
            
            result = inserted[0];
        }

        // Convert numeric fields back to numbers
        return {
            ...result,
            custom_price: parseFloat(result.custom_price),
            discount_percentage: parseFloat(result.discount_percentage)
        };
    } catch (error) {
        console.error('Set client custom pricing failed:', error);
        throw error;
    }
}

export async function getClientCustomPricing(clientId: number): Promise<ClientProductPricing[]> {
    try {
        // Verify client exists
        const client = await db.select()
            .from(clientsTable)
            .where(eq(clientsTable.id, clientId))
            .limit(1)
            .execute();
        
        if (client.length === 0) {
            throw new Error(`Client with ID ${clientId} not found`);
        }

        const results = await db.select()
            .from(clientProductPricingTable)
            .where(eq(clientProductPricingTable.client_id, clientId))
            .execute();

        // Convert numeric fields back to numbers
        return results.map(pricing => ({
            ...pricing,
            custom_price: parseFloat(pricing.custom_price),
            discount_percentage: parseFloat(pricing.discount_percentage)
        }));
    } catch (error) {
        console.error('Get client custom pricing failed:', error);
        throw error;
    }
}

export async function calculateOrderTotal(
    clientId: number,
    items: Array<{ productId: number; quantity: number }>
): Promise<{
    items: Array<{
        productId: number;
        quantity: number;
        basePrice: number;
        customPrice?: number;
        discountPercentage?: number;
        finalPrice: number;
        totalPrice: number;
    }>;
    totalAmount: number;
}> {
    try {
        // Verify client exists
        const client = await db.select()
            .from(clientsTable)
            .where(eq(clientsTable.id, clientId))
            .limit(1)
            .execute();
        
        if (client.length === 0) {
            throw new Error(`Client with ID ${clientId} not found`);
        }

        const calculatedItems = [];
        let totalAmount = 0;

        for (const item of items) {
            // Get product base price
            const product = await db.select()
                .from(productsTable)
                .where(eq(productsTable.id, item.productId))
                .limit(1)
                .execute();
            
            if (product.length === 0) {
                throw new Error(`Product with ID ${item.productId} not found`);
            }

            const basePrice = parseFloat(product[0].base_price);

            // Get custom pricing if it exists
            const customPricing = await db.select()
                .from(clientProductPricingTable)
                .where(and(
                    eq(clientProductPricingTable.client_id, clientId),
                    eq(clientProductPricingTable.product_id, item.productId)
                ))
                .limit(1)
                .execute();

            let finalPrice = basePrice;
            let customPrice: number | undefined;
            let discountPercentage: number | undefined;

            if (customPricing.length > 0) {
                customPrice = parseFloat(customPricing[0].custom_price);
                discountPercentage = parseFloat(customPricing[0].discount_percentage);
                
                // Use custom price if available, otherwise apply discount to base price
                if (customPrice > 0) {
                    finalPrice = customPrice;
                } else if (discountPercentage > 0) {
                    finalPrice = basePrice * (1 - discountPercentage / 100);
                }
            }

            const totalPrice = finalPrice * item.quantity;

            calculatedItems.push({
                productId: item.productId,
                quantity: item.quantity,
                basePrice,
                customPrice,
                discountPercentage,
                finalPrice,
                totalPrice
            });

            totalAmount += totalPrice;
        }

        return {
            items: calculatedItems,
            totalAmount: Math.round(totalAmount * 100) / 100 // Round to 2 decimal places
        };
    } catch (error) {
        console.error('Calculate order total failed:', error);
        throw error;
    }
}

export async function validateStockLimits(
    clientId: number,
    items: Array<{ productId: number; quantity: number }>
): Promise<{
    isValid: boolean;
    violations: Array<{
        productId: number;
        requestedQuantity: number;
        remainingLimit: number;
        monthlyLimit: number;
    }>;
}> {
    try {
        // Verify client exists
        const client = await db.select()
            .from(clientsTable)
            .where(eq(clientsTable.id, clientId))
            .limit(1)
            .execute();
        
        if (client.length === 0) {
            throw new Error(`Client with ID ${clientId} not found`);
        }

        const violations = [];
        
        // Get current month's start date
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        for (const item of items) {
            // Get stock limit for this product
            const customPricing = await db.select()
                .from(clientProductPricingTable)
                .where(and(
                    eq(clientProductPricingTable.client_id, clientId),
                    eq(clientProductPricingTable.product_id, item.productId)
                ))
                .limit(1)
                .execute();

            if (customPricing.length > 0 && customPricing[0].stock_limit_monthly) {
                const monthlyLimit = customPricing[0].stock_limit_monthly;

                // Calculate current month's usage
                const currentUsage = await db.select({
                    totalQuantity: sum(orderItemsTable.quantity)
                })
                .from(orderItemsTable)
                .innerJoin(ordersTable, eq(orderItemsTable.order_id, ordersTable.id))
                .where(and(
                    eq(ordersTable.client_id, clientId),
                    eq(orderItemsTable.product_id, item.productId),
                    gte(ordersTable.created_at, monthStart)
                ))
                .execute();

                const usedQuantity = currentUsage[0].totalQuantity ? parseInt(currentUsage[0].totalQuantity.toString()) : 0;
                const remainingLimit = monthlyLimit - usedQuantity;

                if (item.quantity > remainingLimit) {
                    violations.push({
                        productId: item.productId,
                        requestedQuantity: item.quantity,
                        remainingLimit: Math.max(0, remainingLimit),
                        monthlyLimit
                    });
                }
            }
        }

        return {
            isValid: violations.length === 0,
            violations
        };
    } catch (error) {
        console.error('Validate stock limits failed:', error);
        throw error;
    }
}