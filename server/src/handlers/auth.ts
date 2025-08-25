import { db } from '../db';
import { usersTable, clientsTable } from '../db/schema';
import { type LoginInput, type AuthResponse, type CreateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-secret-key';

// Simple password hashing utility
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  return inputHash === hash;
}

function generateToken(userId: number, email: string, role: string): string {
  // Simple token generation without JWT library
  const payload = JSON.stringify({ userId, email, role, exp: Date.now() + 24 * 60 * 60 * 1000 });
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + signature;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    if (!verifyPassword(input.password, user.password_hash)) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = generateToken(user.id, user.email, user.role);

    // If user is a client, fetch client data
    let clientData = null;
    if (user.role === 'client') {
      const clients = await db.select()
        .from(clientsTable)
        .where(eq(clientsTable.user_id, user.id))
        .execute();

      if (clients.length > 0) {
        const client = clients[0];
        clientData = {
          ...client,
          credit_limit: parseFloat(client.credit_limit),
          current_balance: parseFloat(client.current_balance),
          overdue_amount: parseFloat(client.overdue_amount)
        };
      }
    }

    return {
      token,
      user,
      client: clientData
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function createUser(input: CreateUserInput): Promise<User> {
  try {
    // Check if email already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = hashPassword(input.password);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        role: input.role,
        sage_id: input.sage_id ?? null,
        is_active: true
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}

export async function resetPassword(email: string): Promise<{ success: boolean }> {
  try {
    // Check if user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    // Generate reset token (in a real app, this would be stored and emailed)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // In a real implementation, you would:
    // 1. Store the reset token with expiration in database
    // 2. Send email with reset link to the user
    // 3. Notify director/admin users about the reset request
    
    console.log(`Password reset requested for ${email}. Reset token: ${resetToken}`);

    return { success: true };
  } catch (error) {
    console.error('Password reset failed:', error);
    throw error;
  }
}