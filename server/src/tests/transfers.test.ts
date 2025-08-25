import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, clientsTable, productsTable, ordersTable, transferRequestsTable, stockTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import {
    createTransferRequest,
    getTransferRequestsForWarehouse,
    updateTransferRequestStatus,
    getTransferRequestsByOrder,
    confirmTransferReception,
    getPendingTransferRequestsForIbnTachfine
} from '../handlers/transfers';

describe('Transfer Handlers', () => {
    let testUserId: number;
    let testClientId: number;
    let testProductId: number;
    let testOrderId: number;

    beforeEach(async () => {
        await createDB();

        // Create test user
        const userResult = await db.insert(usersTable)
            .values({
                email: 'test@example.com',
                password_hash: 'hashed_password',
                role: 'representative'
            })
            .returning()
            .execute();
        testUserId = userResult[0].id;

        // Create test client
        const clientResult = await db.insert(clientsTable)
            .values({
                user_id: testUserId,
                company_name: 'Test Company',
                contact_name: 'Test Contact',
                credit_limit: '10000.00'
            })
            .returning()
            .execute();
        testClientId = clientResult[0].id;

        // Create test product
        const productResult = await db.insert(productsTable)
            .values({
                reference: 'TEST001',
                designation: 'Test Product',
                base_price: '99.99'
            })
            .returning()
            .execute();
        testProductId = productResult[0].id;

        // Create test order
        const orderResult = await db.insert(ordersTable)
            .values({
                client_id: testClientId,
                order_number: 'ORD001',
                total_amount: '199.98',
                carrier: 'ghazala'
            })
            .returning()
            .execute();
        testOrderId = orderResult[0].id;

        // Create initial stock at La Villette warehouse
        await db.insert(stockTable)
            .values({
                product_id: testProductId,
                warehouse: 'la_villette',
                quantity: 100
            })
            .execute();
    });

    afterEach(resetDB);

    describe('createTransferRequest', () => {
        it('should create a transfer request successfully', async () => {
            const result = await createTransferRequest(
                testOrderId,
                testProductId,
                'la_villette',
                'ibn_tachfine',
                10,
                testUserId
            );

            expect(result.id).toBeDefined();
            expect(result.order_id).toEqual(testOrderId);
            expect(result.product_id).toEqual(testProductId);
            expect(result.from_warehouse).toEqual('la_villette');
            expect(result.to_warehouse).toEqual('ibn_tachfine');
            expect(result.quantity_requested).toEqual(10);
            expect(result.quantity_prepared).toEqual(0);
            expect(result.status).toEqual('pending');
            expect(result.requested_by).toEqual(testUserId);
            expect(result.prepared_by).toBeNull();
            expect(result.received_by).toBeNull();
            expect(result.requested_at).toBeInstanceOf(Date);
            expect(result.prepared_at).toBeNull();
            expect(result.received_at).toBeNull();
            expect(result.created_at).toBeInstanceOf(Date);
            expect(result.updated_at).toBeInstanceOf(Date);
        });

        it('should save transfer request to database', async () => {
            const result = await createTransferRequest(
                testOrderId,
                testProductId,
                'la_villette',
                'ibn_tachfine',
                15,
                testUserId
            );

            const saved = await db.select()
                .from(transferRequestsTable)
                .where(eq(transferRequestsTable.id, result.id))
                .execute();

            expect(saved).toHaveLength(1);
            expect(saved[0].order_id).toEqual(testOrderId);
            expect(saved[0].product_id).toEqual(testProductId);
            expect(saved[0].from_warehouse).toEqual('la_villette');
            expect(saved[0].to_warehouse).toEqual('ibn_tachfine');
            expect(saved[0].quantity_requested).toEqual(15);
        });

        it('should throw error for non-existent order', async () => {
            await expect(createTransferRequest(
                99999,
                testProductId,
                'la_villette',
                'ibn_tachfine',
                10,
                testUserId
            )).rejects.toThrow(/order.*not found/i);
        });

        it('should throw error for non-existent product', async () => {
            await expect(createTransferRequest(
                testOrderId,
                99999,
                'la_villette',
                'ibn_tachfine',
                10,
                testUserId
            )).rejects.toThrow(/product.*not found/i);
        });

        it('should throw error for non-existent user', async () => {
            await expect(createTransferRequest(
                testOrderId,
                testProductId,
                'la_villette',
                'ibn_tachfine',
                10,
                99999
            )).rejects.toThrow(/user.*not found/i);
        });
    });

    describe('getTransferRequestsForWarehouse', () => {
        it('should return transfer requests for specific warehouse', async () => {
            // Create multiple transfer requests
            await createTransferRequest(testOrderId, testProductId, 'la_villette', 'ibn_tachfine', 10, testUserId);
            await createTransferRequest(testOrderId, testProductId, 'la_villette', 'drb_omar', 5, testUserId);
            await createTransferRequest(testOrderId, testProductId, 'drb_omar', 'ibn_tachfine', 3, testUserId);

            const results = await getTransferRequestsForWarehouse('la_villette');

            expect(results).toHaveLength(2);
            results.forEach(transfer => {
                expect(transfer.from_warehouse).toEqual('la_villette');
            });
        });

        it('should return empty array when no transfers for warehouse', async () => {
            const results = await getTransferRequestsForWarehouse('ibn_tachfine');
            expect(results).toHaveLength(0);
        });
    });

    describe('updateTransferRequestStatus', () => {
        let transferId: number;

        beforeEach(async () => {
            const transfer = await createTransferRequest(
                testOrderId,
                testProductId,
                'la_villette',
                'ibn_tachfine',
                10,
                testUserId
            );
            transferId = transfer.id;
        });

        it('should update status to in_preparation', async () => {
            const result = await updateTransferRequestStatus(
                transferId,
                'in_preparation',
                testUserId,
                8
            );

            expect(result.status).toEqual('in_preparation');
            expect(result.prepared_by).toEqual(testUserId);
            expect(result.prepared_at).toBeInstanceOf(Date);
            expect(result.quantity_prepared).toEqual(8);
            expect(result.updated_at).toBeInstanceOf(Date);
        });

        it('should update status to ready_to_ship', async () => {
            const result = await updateTransferRequestStatus(
                transferId,
                'ready_to_ship',
                testUserId,
                10
            );

            expect(result.status).toEqual('ready_to_ship');
            expect(result.prepared_by).toEqual(testUserId);
            expect(result.prepared_at).toBeInstanceOf(Date);
            expect(result.quantity_prepared).toEqual(10);
        });

        it('should update status to shipped', async () => {
            const result = await updateTransferRequestStatus(
                transferId,
                'shipped',
                testUserId,
                10
            );

            expect(result.status).toEqual('shipped');
            expect(result.quantity_prepared).toEqual(10);
            expect(result.updated_at).toBeInstanceOf(Date);
        });

        it('should throw error for non-existent transfer', async () => {
            await expect(updateTransferRequestStatus(
                99999,
                'in_preparation',
                testUserId
            )).rejects.toThrow(/transfer request.*not found/i);
        });

        it('should throw error for non-existent user', async () => {
            await expect(updateTransferRequestStatus(
                transferId,
                'in_preparation',
                99999
            )).rejects.toThrow(/user.*not found/i);
        });
    });

    describe('getTransferRequestsByOrder', () => {
        it('should return all transfer requests for specific order', async () => {
            // Create additional order
            const order2Result = await db.insert(ordersTable)
                .values({
                    client_id: testClientId,
                    order_number: 'ORD002',
                    total_amount: '299.97',
                    carrier: 'sh2t'
                })
                .returning()
                .execute();
            const testOrder2Id = order2Result[0].id;

            // Create transfer requests for both orders
            await createTransferRequest(testOrderId, testProductId, 'la_villette', 'ibn_tachfine', 10, testUserId);
            await createTransferRequest(testOrderId, testProductId, 'la_villette', 'drb_omar', 5, testUserId);
            await createTransferRequest(testOrder2Id, testProductId, 'drb_omar', 'ibn_tachfine', 3, testUserId);

            const results = await getTransferRequestsByOrder(testOrderId);

            expect(results).toHaveLength(2);
            results.forEach(transfer => {
                expect(transfer.order_id).toEqual(testOrderId);
            });
        });

        it('should return empty array when no transfers for order', async () => {
            const results = await getTransferRequestsByOrder(99999);
            expect(results).toHaveLength(0);
        });
    });

    describe('confirmTransferReception', () => {
        let transferId: number;
        let warehouseUserId: number;

        beforeEach(async () => {
            // Create warehouse user
            const warehouseUserResult = await db.insert(usersTable)
                .values({
                    email: 'warehouse@example.com',
                    password_hash: 'hashed_password',
                    role: 'counter_ibn_tachfine'
                })
                .returning()
                .execute();
            warehouseUserId = warehouseUserResult[0].id;

            // Create and ship a transfer request
            const transfer = await createTransferRequest(
                testOrderId,
                testProductId,
                'la_villette',
                'ibn_tachfine',
                10,
                testUserId
            );
            transferId = transfer.id;

            await updateTransferRequestStatus(transferId, 'shipped', testUserId, 10);
        });

        it('should confirm transfer reception and update stock', async () => {
            const result = await confirmTransferReception(transferId, warehouseUserId, 10);

            expect(result.status).toEqual('received');
            expect(result.received_by).toEqual(warehouseUserId);
            expect(result.received_at).toBeInstanceOf(Date);
            expect(result.updated_at).toBeInstanceOf(Date);

            // Check stock was updated at destination
            const destinationStock = await db.select()
                .from(stockTable)
                .where(and(
                    eq(stockTable.product_id, testProductId),
                    eq(stockTable.warehouse, 'ibn_tachfine')
                ))
                .execute();

            expect(destinationStock).toHaveLength(1);
            expect(destinationStock[0].quantity).toEqual(10);

            // Check stock was reduced at source
            const sourceStock = await db.select()
                .from(stockTable)
                .where(and(
                    eq(stockTable.product_id, testProductId),
                    eq(stockTable.warehouse, 'la_villette')
                ))
                .execute();

            expect(sourceStock).toHaveLength(1);
            expect(sourceStock[0].quantity).toEqual(90); // 100 - 10
        });

        it('should handle reception when destination stock already exists', async () => {
            // Create existing stock at destination
            await db.insert(stockTable)
                .values({
                    product_id: testProductId,
                    warehouse: 'ibn_tachfine',
                    quantity: 25
                })
                .execute();

            await confirmTransferReception(transferId, warehouseUserId, 10);

            // Check stock was added to existing stock
            const destinationStock = await db.select()
                .from(stockTable)
                .where(and(
                    eq(stockTable.product_id, testProductId),
                    eq(stockTable.warehouse, 'ibn_tachfine')
                ))
                .execute();

            expect(destinationStock).toHaveLength(1);
            expect(destinationStock[0].quantity).toEqual(35); // 25 + 10
        });

        it('should throw error for non-existent transfer', async () => {
            await expect(confirmTransferReception(
                99999,
                warehouseUserId,
                10
            )).rejects.toThrow(/transfer request.*not found/i);
        });

        it('should throw error when transfer is not in shipped status', async () => {
            // Create pending transfer
            const pendingTransfer = await createTransferRequest(
                testOrderId,
                testProductId,
                'la_villette',
                'ibn_tachfine',
                5,
                testUserId
            );

            await expect(confirmTransferReception(
                pendingTransfer.id,
                warehouseUserId,
                5
            )).rejects.toThrow(/must be in 'shipped' status/i);
        });

        it('should throw error for non-existent user', async () => {
            await expect(confirmTransferReception(
                transferId,
                99999,
                10
            )).rejects.toThrow(/user.*not found/i);
        });
    });

    describe('getPendingTransferRequestsForIbnTachfine', () => {
        it('should return transfers ready for reception at Ibn Tachfine', async () => {
            // Create multiple transfers with different statuses
            const transfer1 = await createTransferRequest(testOrderId, testProductId, 'la_villette', 'ibn_tachfine', 10, testUserId);
            const transfer2 = await createTransferRequest(testOrderId, testProductId, 'la_villette', 'ibn_tachfine', 5, testUserId);
            const transfer3 = await createTransferRequest(testOrderId, testProductId, 'la_villette', 'drb_omar', 3, testUserId);

            // Update statuses
            await updateTransferRequestStatus(transfer1.id, 'shipped', testUserId, 10);
            await updateTransferRequestStatus(transfer2.id, 'ready_to_ship', testUserId, 5);
            // transfer3 stays pending and goes to different warehouse

            const results = await getPendingTransferRequestsForIbnTachfine();

            expect(results).toHaveLength(2);
            
            const statuses = results.map(t => t.status).sort();
            expect(statuses).toEqual(['ready_to_ship', 'shipped']);
            
            results.forEach(transfer => {
                expect(transfer.to_warehouse).toEqual('ibn_tachfine');
            });
        });

        it('should return empty array when no pending transfers for Ibn Tachfine', async () => {
            // Create transfer to different warehouse
            await createTransferRequest(testOrderId, testProductId, 'la_villette', 'drb_omar', 10, testUserId);

            const results = await getPendingTransferRequestsForIbnTachfine();
            expect(results).toHaveLength(0);
        });

        it('should not return received or cancelled transfers', async () => {
            const warehouseUserResult = await db.insert(usersTable)
                .values({
                    email: 'warehouse2@example.com',
                    password_hash: 'hashed_password',
                    role: 'counter_ibn_tachfine'
                })
                .returning()
                .execute();

            const transfer = await createTransferRequest(testOrderId, testProductId, 'la_villette', 'ibn_tachfine', 10, testUserId);
            await updateTransferRequestStatus(transfer.id, 'shipped', testUserId, 10);
            await confirmTransferReception(transfer.id, warehouseUserResult[0].id, 10);

            const results = await getPendingTransferRequestsForIbnTachfine();
            expect(results).toHaveLength(0);
        });
    });
});