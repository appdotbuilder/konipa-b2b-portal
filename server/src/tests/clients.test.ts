import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { clientsTable, usersTable } from '../db/schema';
import { type CreateClientInput } from '../schema';
import { createClient } from '../handlers/clients';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateClientInput = {
  user_id: 1,
  company_name: 'Test Company Ltd',
  contact_name: 'John Doe',
  phone: '+1234567890',
  address: '123 Test Street',
  city: 'Test City',
  credit_limit: 50000,
  representative_id: 2
};

describe('createClient', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  beforeEach(async () => {
    // Create test user with client role
    await db.insert(usersTable).values({
      email: 'client@test.com',
      password_hash: 'hashed_password',
      role: 'client',
      sage_id: 'SAGE001'
    }).execute();

    // Create test representative
    await db.insert(usersTable).values({
      email: 'rep@test.com',
      password_hash: 'hashed_password',
      role: 'representative',
      sage_id: 'REP001'
    }).execute();
  });

  it('should create a client with all fields', async () => {
    const result = await createClient(testInput);

    // Basic field validation
    expect(result.user_id).toEqual(1);
    expect(result.company_name).toEqual('Test Company Ltd');
    expect(result.contact_name).toEqual('John Doe');
    expect(result.phone).toEqual('+1234567890');
    expect(result.address).toEqual('123 Test Street');
    expect(result.city).toEqual('Test City');
    expect(result.credit_limit).toEqual(50000);
    expect(typeof result.credit_limit).toBe('number');
    expect(result.representative_id).toEqual(2);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Default values
    expect(result.current_balance).toEqual(0);
    expect(result.overdue_amount).toEqual(0);
    expect(result.payment_due_date).toBeNull();
    expect(result.is_blocked).toBe(false);
  });

  it('should create a client with minimal required fields', async () => {
    const minimalInput: CreateClientInput = {
      user_id: 1,
      company_name: 'Minimal Company',
      contact_name: 'Jane Smith',
      credit_limit: 25000
    };

    const result = await createClient(minimalInput);

    expect(result.user_id).toEqual(1);
    expect(result.company_name).toEqual('Minimal Company');
    expect(result.contact_name).toEqual('Jane Smith');
    expect(result.credit_limit).toEqual(25000);
    expect(result.phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.city).toBeNull();
    expect(result.representative_id).toBeNull();
  });

  it('should save client to database', async () => {
    const result = await createClient(testInput);

    // Query database to verify client was saved
    const clients = await db.select()
      .from(clientsTable)
      .where(eq(clientsTable.id, result.id))
      .execute();

    expect(clients).toHaveLength(1);
    expect(clients[0].company_name).toEqual('Test Company Ltd');
    expect(clients[0].contact_name).toEqual('John Doe');
    expect(parseFloat(clients[0].credit_limit)).toEqual(50000);
    expect(clients[0].user_id).toEqual(1);
    expect(clients[0].representative_id).toEqual(2);
    expect(clients[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle numeric field conversions correctly', async () => {
    const result = await createClient(testInput);

    // Verify numeric fields are returned as numbers
    expect(typeof result.credit_limit).toBe('number');
    expect(typeof result.current_balance).toBe('number');
    expect(typeof result.overdue_amount).toBe('number');

    // Verify precision is maintained
    const preciseInput: CreateClientInput = {
      user_id: 1,
      company_name: 'Precise Company',
      contact_name: 'Precise Contact',
      credit_limit: 12345.67
    };

    const preciseResult = await createClient(preciseInput);
    expect(preciseResult.credit_limit).toEqual(12345.67);
  });

  it('should throw error when user does not exist', async () => {
    const invalidInput: CreateClientInput = {
      ...testInput,
      user_id: 999 // Non-existent user
    };

    await expect(createClient(invalidInput)).rejects.toThrow(/User with id 999 not found/i);
  });

  it('should throw error when user does not have client role', async () => {
    // Create user with different role
    await db.insert(usersTable).values({
      email: 'admin@test.com',
      password_hash: 'hashed_password',
      role: 'director_admin'
    }).execute();

    const invalidInput: CreateClientInput = {
      ...testInput,
      user_id: 3 // User with admin role
    };

    await expect(createClient(invalidInput)).rejects.toThrow(/User must have 'client' role, but has 'director_admin' role/i);
  });

  it('should throw error when representative does not exist', async () => {
    const invalidInput: CreateClientInput = {
      ...testInput,
      representative_id: 999 // Non-existent representative
    };

    await expect(createClient(invalidInput)).rejects.toThrow(/Representative with id 999 not found/i);
  });

  it('should throw error when representative does not have representative role', async () => {
    // Create user with different role
    await db.insert(usersTable).values({
      email: 'warehouse@test.com',
      password_hash: 'hashed_password',
      role: 'warehouse_la_villette'
    }).execute();

    const invalidInput: CreateClientInput = {
      ...testInput,
      representative_id: 3 // User with warehouse role
    };

    await expect(createClient(invalidInput)).rejects.toThrow(/User must have 'representative' role, but has 'warehouse_la_villette' role/i);
  });

  it('should allow creating client without representative', async () => {
    const inputWithoutRep: CreateClientInput = {
      user_id: 1,
      company_name: 'No Rep Company',
      contact_name: 'Independent Client',
      credit_limit: 10000
    };

    const result = await createClient(inputWithoutRep);

    expect(result.representative_id).toBeNull();
    expect(result.company_name).toEqual('No Rep Company');
    expect(result.contact_name).toEqual('Independent Client');
  });

  it('should handle special characters in text fields', async () => {
    const specialInput: CreateClientInput = {
      user_id: 1,
      company_name: 'Société Générale & Co.',
      contact_name: 'José María',
      phone: '+33-1-23-45-67-89',
      address: '123 Rue de l\'Église, Bâtiment A',
      city: 'Saint-Étienne',
      credit_limit: 75000,
      representative_id: 2
    };

    const result = await createClient(specialInput);

    expect(result.company_name).toEqual('Société Générale & Co.');
    expect(result.contact_name).toEqual('José María');
    expect(result.phone).toEqual('+33-1-23-45-67-89');
    expect(result.address).toEqual('123 Rue de l\'Église, Bâtiment A');
    expect(result.city).toEqual('Saint-Étienne');
  });
});