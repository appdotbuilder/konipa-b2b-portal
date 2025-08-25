import { db } from '../db';
import { clientsTable, usersTable } from '../db/schema';
import { type CreateClientInput, type Client } from '../schema';
import { eq } from 'drizzle-orm';

export async function createClient(input: CreateClientInput): Promise<Client> {
  try {
    // Verify that the user exists and has 'client' role
    const userResult = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (userResult.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    const user = userResult[0];
    if (user.role !== 'client') {
      throw new Error(`User must have 'client' role, but has '${user.role}' role`);
    }

    // Verify representative exists if provided
    if (input.representative_id) {
      const repResult = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, input.representative_id))
        .execute();

      if (repResult.length === 0) {
        throw new Error(`Representative with id ${input.representative_id} not found`);
      }

      const representative = repResult[0];
      if (representative.role !== 'representative') {
        throw new Error(`User must have 'representative' role, but has '${representative.role}' role`);
      }
    }

    // Insert client record
    const result = await db.insert(clientsTable)
      .values({
        user_id: input.user_id,
        company_name: input.company_name,
        contact_name: input.contact_name,
        phone: input.phone || null,
        address: input.address || null,
        city: input.city || null,
        credit_limit: input.credit_limit.toString(), // Convert number to string for numeric column
        representative_id: input.representative_id || null
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const client = result[0];
    return {
      ...client,
      credit_limit: parseFloat(client.credit_limit), // Convert string back to number
      current_balance: parseFloat(client.current_balance),
      overdue_amount: parseFloat(client.overdue_amount)
    };
  } catch (error) {
    console.error('Client creation failed:', error);
    throw error;
  }
}

export async function getClientById(clientId: number): Promise<Client | null> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching client details by ID with user and representative data.
    return Promise.resolve(null);
}

export async function getClientsByRepresentative(representativeId: number): Promise<Client[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching all clients assigned to a specific representative.
    return Promise.resolve([]);
}

export async function updateClientCreditStatus(clientId: number, isBlocked: boolean, updatedBy: number): Promise<Client> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is blocking/unblocking client accounts for credit management.
    return Promise.resolve({} as Client);
}

export async function getClientDashboardData(clientId: number): Promise<{
    totalRevenue: number;
    orderCount: number;
    currentBalance: number;
    overdueAmount: number;
    creditLimit: number;
    paymentDueDate: Date | null;
}> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is providing 360° dashboard data for clients.
    return Promise.resolve({
        totalRevenue: 0,
        orderCount: 0,
        currentBalance: 0,
        overdueAmount: 0,
        creditLimit: 0,
        paymentDueDate: null
    });
}