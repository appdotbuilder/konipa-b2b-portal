import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, clientsTable } from '../db/schema';
import { type LoginInput, type CreateUserInput } from '../schema';
import { login, createUser, resetPassword } from '../handlers/auth';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-secret-key';

// Helper function to decode our simple token format
function decodeToken(token: string): any {
  const [payloadBase64] = token.split('.');
  const payload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
  return JSON.parse(payload);
}

// Test data
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  role: 'representative',
  sage_id: 'SAGE001'
};

const testClientUserInput: CreateUserInput = {
  email: 'client@example.com',
  password: 'clientpass',
  role: 'client'
};

const testLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('Auth Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const result = await createUser(testUserInput);

      expect(result.email).toEqual(testUserInput.email);
      expect(result.role).toEqual(testUserInput.role);
      expect(result.sage_id).toEqual(testUserInput.sage_id ?? null);
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.password_hash).toBeDefined();
      expect(result.password_hash).not.toEqual(testUserInput.password); // Should be hashed
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save user to database', async () => {
      const result = await createUser(testUserInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].email).toEqual(testUserInput.email);
      expect(users[0].role).toEqual(testUserInput.role);
      expect(users[0].sage_id).toEqual(testUserInput.sage_id ?? null);
      expect(users[0].is_active).toBe(true);
    });

    it('should create user without sage_id', async () => {
      const inputWithoutSage: CreateUserInput = {
        email: 'nosage@example.com',
        password: 'password123',
        role: 'accounting'
      };

      const result = await createUser(inputWithoutSage);

      expect(result.sage_id).toBeNull();
    });

    it('should throw error for duplicate email', async () => {
      await createUser(testUserInput);

      await expect(createUser(testUserInput)).rejects.toThrow(/email already exists/i);
    });

    it('should hash password correctly', async () => {
      const result = await createUser(testUserInput);

      // Password should be hashed, not stored in plain text
      expect(result.password_hash).not.toEqual(testUserInput.password);
      expect(result.password_hash).toHaveLength(64); // SHA256 hex length
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create test user for login tests
      await createUser(testUserInput);
    });

    it('should login successfully with valid credentials', async () => {
      const result = await login(testLoginInput);

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.user.email).toEqual(testLoginInput.email);
      expect(result.user.role).toEqual('representative');
      expect(result.user.is_active).toBe(true);
      expect(result.client).toBeNull(); // Not a client user
    });

    it('should generate valid token', async () => {
      const result = await login(testLoginInput);

      const decoded = decodeToken(result.token);
      expect(decoded.email).toEqual(testLoginInput.email);
      expect(decoded.role).toEqual('representative');
      expect(decoded.userId).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now()); // Token should not be expired
    });

    it('should throw error for invalid email', async () => {
      const invalidLogin: LoginInput = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      await expect(login(invalidLogin)).rejects.toThrow(/invalid credentials/i);
    });

    it('should throw error for invalid password', async () => {
      const invalidLogin: LoginInput = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await expect(login(invalidLogin)).rejects.toThrow(/invalid credentials/i);
    });

    it('should throw error for inactive user', async () => {
      // Deactivate the user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.email, testUserInput.email))
        .execute();

      await expect(login(testLoginInput)).rejects.toThrow(/account is deactivated/i);
    });

    it('should include client data for client users', async () => {
      // Create client user
      const clientUser = await createUser(testClientUserInput);

      // Create associated client record
      await db.insert(clientsTable)
        .values({
          user_id: clientUser.id,
          company_name: 'Test Company',
          contact_name: 'John Doe',
          phone: '+1234567890',
          address: '123 Test St',
          city: 'Test City',
          credit_limit: '5000.00',
          current_balance: '1500.50',
          overdue_amount: '200.00'
        })
        .execute();

      const clientLogin: LoginInput = {
        email: testClientUserInput.email,
        password: testClientUserInput.password
      };

      const result = await login(clientLogin);

      expect(result.client).toBeDefined();
      expect(result.client?.company_name).toEqual('Test Company');
      expect(result.client?.contact_name).toEqual('John Doe');
      expect(typeof result.client?.credit_limit).toBe('number');
      expect(result.client?.credit_limit).toEqual(5000.00);
      expect(typeof result.client?.current_balance).toBe('number');
      expect(result.client?.current_balance).toEqual(1500.50);
      expect(typeof result.client?.overdue_amount).toBe('number');
      expect(result.client?.overdue_amount).toEqual(200.00);
    });

    it('should handle client user without client record', async () => {
      // Create client user without client record
      await createUser(testClientUserInput);

      const clientLogin: LoginInput = {
        email: testClientUserInput.email,
        password: testClientUserInput.password
      };

      const result = await login(clientLogin);

      expect(result.client).toBeNull();
      expect(result.user.role).toEqual('client');
    });
  });

  describe('resetPassword', () => {
    beforeEach(async () => {
      await createUser(testUserInput);
    });

    it('should initiate password reset for existing user', async () => {
      const result = await resetPassword(testUserInput.email);

      expect(result.success).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      await expect(resetPassword('nonexistent@example.com')).rejects.toThrow(/user not found/i);
    });

    it('should handle multiple reset requests', async () => {
      const result1 = await resetPassword(testUserInput.email);
      const result2 = await resetPassword(testUserInput.email);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle various user roles correctly', async () => {
      const roles = ['representative', 'accounting', 'counter_ibn_tachfine', 'warehouse_la_villette', 'director_admin'] as const;

      for (const role of roles) {
        const userInput: CreateUserInput = {
          email: `${role}@example.com`,
          password: 'password123',
          role
        };

        const user = await createUser(userInput);
        expect(user.role).toEqual(role);

        const loginInput: LoginInput = {
          email: userInput.email,
          password: userInput.password
        };

        const loginResult = await login(loginInput);
        expect(loginResult.user.role).toEqual(role);
        expect(loginResult.client).toBeNull(); // Non-client roles
      }
    });

    it('should maintain data integrity across operations', async () => {
      // Create user
      const user = await createUser(testUserInput);

      // Verify user exists in database
      const dbUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.email, testUserInput.email))
        .execute();

      expect(dbUsers).toHaveLength(1);
      expect(dbUsers[0].id).toEqual(user.id);

      // Login should work
      const loginResult = await login(testLoginInput);
      expect(loginResult.user.id).toEqual(user.id);

      // Reset password should work
      const resetResult = await resetPassword(testUserInput.email);
      expect(resetResult.success).toBe(true);
    });
  });
});