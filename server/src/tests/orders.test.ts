import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, clientsTable, ordersTable } from '../db/schema';
import { type UpdateOrderStatusInput } from '../schema';
import { updateOrderStatus } from '../handlers/orders';
import { eq } from 'drizzle-orm';

describe('updateOrderStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test prerequisites
  async function createTestData() {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'client'
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create a client
    const clientResult = await db.insert(clientsTable)
      .values({
        user_id: user.id,
        company_name: 'Test Company',
        contact_name: 'John Doe',
        credit_limit: '10000.00',
        current_balance: '0.00',
        overdue_amount: '0.00',
        is_blocked: false
      })
      .returning()
      .execute();

    const client = clientResult[0];

    // Create a representative
    const repResult = await db.insert(usersTable)
      .values({
        email: 'rep@example.com',
        password_hash: 'hashed_password',
        role: 'representative'
      })
      .returning()
      .execute();

    const representative = repResult[0];

    // Create an order
    const orderResult = await db.insert(ordersTable)
      .values({
        client_id: client.id,
        representative_id: representative.id,
        order_number: 'ORD-2024-001',
        status: 'submitted',
        total_amount: '500.00',
        carrier: 'ghazala',
        is_grouped: false
      })
      .returning()
      .execute();

    return {
      user,
      client,
      representative,
      order: orderResult[0]
    };
  }

  it('should update order status to validated', async () => {
    const { order, representative } = await createTestData();

    const input: UpdateOrderStatusInput = {
      order_id: order.id,
      status: 'validated',
      updated_by: representative.id
    };

    const result = await updateOrderStatus(input);

    expect(result.id).toEqual(order.id);
    expect(result.status).toEqual('validated');
    expect(result.validated_by).toEqual(representative.id);
    expect(result.validated_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.total_amount).toEqual(500.00);
    expect(typeof result.total_amount).toBe('number');
  });

  it('should update order status to shipped with timestamp', async () => {
    const { order, representative } = await createTestData();

    const input: UpdateOrderStatusInput = {
      order_id: order.id,
      status: 'shipped',
      updated_by: representative.id
    };

    const result = await updateOrderStatus(input);

    expect(result.status).toEqual('shipped');
    expect(result.shipped_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.validated_by).toBeNull(); // Should not set validated_by for shipped status
  });

  it('should update order status to delivered with timestamp', async () => {
    const { order, representative } = await createTestData();

    const input: UpdateOrderStatusInput = {
      order_id: order.id,
      status: 'delivered',
      updated_by: representative.id
    };

    const result = await updateOrderStatus(input);

    expect(result.status).toEqual('delivered');
    expect(result.delivered_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update order status to in_preparation without special timestamps', async () => {
    const { order, representative } = await createTestData();

    const input: UpdateOrderStatusInput = {
      order_id: order.id,
      status: 'in_preparation',
      updated_by: representative.id
    };

    const result = await updateOrderStatus(input);

    expect(result.status).toEqual('in_preparation');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.validated_by).toBeNull();
    expect(result.validated_at).toBeNull();
    expect(result.shipped_at).toBeNull();
    expect(result.delivered_at).toBeNull();
  });

  it('should save updated order to database', async () => {
    const { order, representative } = await createTestData();

    const input: UpdateOrderStatusInput = {
      order_id: order.id,
      status: 'validated',
      updated_by: representative.id
    };

    await updateOrderStatus(input);

    // Verify the order was updated in the database
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, order.id))
      .execute();

    expect(orders).toHaveLength(1);
    expect(orders[0].status).toEqual('validated');
    expect(orders[0].validated_by).toEqual(representative.id);
    expect(orders[0].validated_at).toBeInstanceOf(Date);
    expect(orders[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle all valid order statuses', async () => {
    const { order, representative } = await createTestData();

    const validStatuses = [
      'submitted',
      'validated', 
      'in_preparation',
      'ready',
      'shipped',
      'delivered',
      'refused'
    ] as const;

    for (const status of validStatuses) {
      const input: UpdateOrderStatusInput = {
        order_id: order.id,
        status: status,
        updated_by: representative.id
      };

      const result = await updateOrderStatus(input);
      expect(result.status).toEqual(status);
      expect(result.updated_at).toBeInstanceOf(Date);
    }
  });

  it('should preserve other order fields when updating status', async () => {
    const { order, representative } = await createTestData();

    const input: UpdateOrderStatusInput = {
      order_id: order.id,
      status: 'ready',
      updated_by: representative.id
    };

    const result = await updateOrderStatus(input);

    expect(result.client_id).toEqual(order.client_id);
    expect(result.representative_id).toEqual(order.representative_id);
    expect(result.order_number).toEqual(order.order_number);
    expect(result.total_amount).toEqual(500.00);
    expect(result.carrier).toEqual(order.carrier);
    expect(result.is_grouped).toEqual(order.is_grouped);
    expect(result.created_at).toEqual(order.created_at);
  });

  it('should throw error for non-existent order', async () => {
    const input: UpdateOrderStatusInput = {
      order_id: 99999,
      status: 'validated',
      updated_by: 1
    };

    await expect(updateOrderStatus(input))
      .rejects
      .toThrow(/Order with id 99999 not found/i);
  });

  it('should handle multiple status updates correctly', async () => {
    const { order, representative } = await createTestData();

    // First update to validated
    await updateOrderStatus({
      order_id: order.id,
      status: 'validated',
      updated_by: representative.id
    });

    // Then update to shipped
    const finalResult = await updateOrderStatus({
      order_id: order.id,
      status: 'shipped',
      updated_by: representative.id
    });

    expect(finalResult.status).toEqual('shipped');
    expect(finalResult.validated_by).toEqual(representative.id);
    expect(finalResult.validated_at).toBeInstanceOf(Date);
    expect(finalResult.shipped_at).toBeInstanceOf(Date);
    expect(finalResult.updated_at).toBeInstanceOf(Date);
  });
});