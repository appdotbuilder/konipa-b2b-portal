import { db } from '../db';
import { quotesTable, quoteItemsTable, productsTable, clientsTable, usersTable, clientProductPricingTable } from '../db/schema';
import { type CreateQuoteInput, type Quote, type QuoteItem } from '../schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

// Generate a unique quote number
function generateQuoteNumber(): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = randomBytes(2).toString('hex').toUpperCase();
  return `QUO-${timestamp}-${random}`;
}

// Generate QR code data (simplified for this implementation)
function generateQRCode(quoteId: number, shareToken: string): string {
  return `QUOTE:${quoteId}:${shareToken}`;
}

// Generate share token
function generateShareToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createQuote(input: CreateQuoteInput): Promise<Quote> {
  try {
    // Validate that client exists
    const client = await db.select()
      .from(clientsTable)
      .where(eq(clientsTable.id, input.client_id))
      .limit(1)
      .execute();
    
    if (client.length === 0) {
      throw new Error(`Client with ID ${input.client_id} not found`);
    }

    // Validate that representative exists and has correct role
    const representative = await db.select()
      .from(usersTable)
      .where(and(
        eq(usersTable.id, input.representative_id),
        eq(usersTable.role, 'representative')
      ))
      .limit(1)
      .execute();
    
    if (representative.length === 0) {
      throw new Error(`Representative with ID ${input.representative_id} not found`);
    }

    // Validate that all products exist and calculate total amount
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of input.items) {
      // Get product details
      const product = await db.select()
        .from(productsTable)
        .where(and(
          eq(productsTable.id, item.product_id),
          eq(productsTable.is_active, true)
        ))
        .limit(1)
        .execute();

      if (product.length === 0) {
        throw new Error(`Product with ID ${item.product_id} not found or inactive`);
      }

      // Check for custom pricing for this client-product combination
      const customPricing = await db.select()
        .from(clientProductPricingTable)
        .where(and(
          eq(clientProductPricingTable.client_id, input.client_id),
          eq(clientProductPricingTable.product_id, item.product_id)
        ))
        .limit(1)
        .execute();

      // Use custom price if available, otherwise use base price
      const unitPrice = customPricing.length > 0 
        ? parseFloat(customPricing[0].custom_price)
        : parseFloat(product[0].base_price);

      const itemTotal = unitPrice * item.quantity;
      totalAmount += itemTotal;

      validatedItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: itemTotal
      });
    }

    // Generate quote details
    const quoteNumber = generateQuoteNumber();
    const shareToken = generateShareToken();
    const shareLink = `https://portal.konipa.com/quotes/share/${shareToken}`;
    const expiresAt = new Date(Date.now() + (input.expires_in_days * 24 * 60 * 60 * 1000));

    // Create quote record
    const quoteResult = await db.insert(quotesTable)
      .values({
        client_id: input.client_id,
        representative_id: input.representative_id,
        quote_number: quoteNumber,
        total_amount: totalAmount.toString(),
        qr_code: '', // Will be updated after we have the quote ID
        share_link: shareLink,
        is_converted_to_order: false,
        order_id: null,
        expires_at: expiresAt
      })
      .returning()
      .execute();

    const quote = quoteResult[0];

    // Generate QR code with actual quote ID
    const qrCode = generateQRCode(quote.id, shareToken);
    
    // Update quote with QR code
    await db.update(quotesTable)
      .set({ qr_code: qrCode })
      .where(eq(quotesTable.id, quote.id))
      .execute();

    // Create quote items
    for (const item of validatedItems) {
      await db.insert(quoteItemsTable)
        .values({
          quote_id: quote.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price.toString(),
          total_price: item.total_price.toString()
        })
        .execute();
    }

    // Return the complete quote with proper numeric conversion
    return {
      ...quote,
      total_amount: parseFloat(quote.total_amount),
      qr_code: qrCode
    };
  } catch (error) {
    console.error('Quote creation failed:', error);
    throw error;
  }
}

export async function getQuoteById(quoteId: number): Promise<Quote | null> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching quote details by ID.
    return Promise.resolve(null);
}

export async function getQuoteByShareToken(shareToken: string): Promise<Quote | null> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching quotes via public share link for client access.
    return Promise.resolve(null);
}

export async function getQuoteItems(quoteId: number): Promise<QuoteItem[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching all items in a specific quote.
    return Promise.resolve([]);
}

export async function convertQuoteToOrder(quoteId: number, carrier: string): Promise<{ quote: Quote; order: any }> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is converting approved quotes into orders with traceability.
    return Promise.resolve({
        quote: {} as Quote,
        order: {}
    });
}

export async function getQuotesByRepresentative(representativeId: number): Promise<Quote[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching all quotes created by a specific representative.
    return Promise.resolve([]);
}

export async function getQuotesByClient(clientId: number): Promise<Quote[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching all quotes for a specific client.
    return Promise.resolve([]);
}